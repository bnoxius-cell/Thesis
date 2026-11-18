import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import scheduleModel from '../models/scheduleModel.js';
import subjectModel from '../models/subjectModel.js';
import classChoiceModel from '../models/classChoiceModel.js';
import notificationModel from '../models/notificationModel.js';
import Friend from '../models/Friend.js';
import groupModel from '../models/groupMode.js';
import { syncGroupTimetable } from '../utils/groupPlan.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { resetRateLimits } from '../utils/rateLimit.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/holidays.js', () => ({ fetchPublicHolidays: vi.fn().mockResolvedValue([]) }));

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    resetRateLimits();
});
afterAll(closeTestDB);

const MONDAY = '2026-11-16';

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

const CLASSES = [
    { title: 'Web Systems', days: [1] },
    { title: 'Networking', days: [2] },
    { title: 'Database', days: [3] },
    { title: 'Ethics', days: [4] },
];
const classBody = (overrides = {}) => ({ kind: 'class', startTime: '08:00', endTime: '10:00', ...overrides });

const base = (timetable) => `/api/schedules/${timetable._id}`;
const mine = (timetable) => `${base(timetable)}/mine`;
const onClass = (timetable, entryId) => `${mine(timetable)}/classes/${entryId}`;

// Alice owns BSIT 3-1 and its timetable (four classes), Ann is an admin, Bob, Iris and Cy are members,
// Carol is an outsider. `ids` maps class titles to the group timetable's entry ids.
const setup = async () => {
    const [alice, ann, bob, iris, cy, carol] = await Promise.all([
        ['alice', 'Alice'], ['ann', 'Ann'], ['bob', 'Bob'], ['iris', 'Iris'], ['cy', 'Cy'], ['carol', 'Carol'],
    ].map(([handle, name]) => signUp(`${handle}@student.fatima.edu.ph`, name)));
    const { group } = (await alice.post('/api/groups').send({ name: 'BSIT 3-1' })).body;
    for (const member of [ann, bob, iris, cy]) await member.post('/api/groups/join').send({ joinCode: group.joinCode });
    await alice.post(`/api/groups/${group._id}/admins`).send({ userId: ann.id });
    const timetable = (await alice.post(`/api/groups/${group._id}/timetable`)).body.timetable;
    for (const c of CLASSES) await alice.post(`${base(timetable)}/entries`).send(classBody(c));
    const { entries } = await scheduleModel.findById(timetable._id).lean();
    const ids = Object.fromEntries(entries.map((e) => [e.title, String(e._id)]));
    return { alice, ann, bob, iris, cy, carol, group, timetable, ids };
};

const countIt = (agent, timetable) => agent.put(`${base(timetable)}/membership`).send({ countInWorkload: true });

// Every entry of the caller's week, with the day it falls on.
const weekOf = async (agent) => {
    const res = await agent.get(`/api/schedules/week?start=${MONDAY}`);
    expect(res.status).toBe(200);
    return res.body.days.flatMap((day) => day.entries.map((entry) => ({ ...entry, iso: day.date })));
};
const titles = (entries) => entries.map((e) => e.title).sort();
const named = (entries, title) => entries.filter((e) => e.title === title);

const sharedEntry = async (agent, timetable, entryId) => (await agent.get(base(timetable))).body.schedule.entries
    .find((e) => String(e._id) === entryId);
const myClasses = async (agent, group) => (await agent.get(`/api/groups/${group._id}/plan`)).body.myClasses;
const mainOf = (agent) => scheduleModel.findOne({ owner: agent.id, isMain: true }).lean();
const choiceDoc = (agent, timetable) => classChoiceModel.findOne({ user: agent.id, schedule: timetable._id }).lean();
const changeLines = (agent) => notificationModel.find({ recipient: agent.id, type: 'schedule_change' }).lean();

// Moves a class (the whole class body is sent, as the client does).
const moveClass = (agent, scheduleId, entryId, title, times, days = [1]) => agent
    .put(`/api/schedules/${scheduleId}/entries/${entryId}`)
    .send(classBody({ title, days, ...times }));

const customize = async (agent, timetable, entryId) => {
    const res = await agent.post(`${onClass(timetable, entryId)}/customize`);
    expect(res.status).toBe(201);
    return res.body;
};

describe('the join checklist', () => {
    test("Iris takes 2 of 4: her week has 2, Bob's 4, and her copy of the timetable marks the other 2 hidden", async () => {
        const { bob, iris, timetable, ids } = await setup();
        await countIt(bob, timetable);
        const res = await iris.put(`${mine(timetable)}/setup`).send({ taking: [ids['Web Systems'], ids.Networking] });
        expect(res.status).toBe(200);
        expect(res.body.myClasses.setupAt).toBeTruthy();

        expect(titles(await weekOf(iris))).toEqual(['Networking', 'Web Systems']);
        expect(titles(await weekOf(bob))).toEqual(['Database', 'Ethics', 'Networking', 'Web Systems']);

        const { schedule } = (await iris.get(base(timetable))).body;
        expect(schedule.myCountInWorkload).toBe(true);
        expect(schedule.entries).toHaveLength(4);
        const choiceOf = Object.fromEntries(schedule.entries.map((e) => [e.title, e.myChoice]));
        expect(choiceOf).toEqual({ 'Web Systems': 'follow', Networking: 'follow', Database: 'hidden', Ethics: 'hidden' });
        expect(schedule.entries.every((e) => e.notice === null)).toBe(true);
    });

    test('a followed class in the week carries its choice and group; the stamp does not move for member writes', async () => {
        const { iris, group, timetable, ids } = await setup();
        const before = (await scheduleModel.findById(timetable._id).lean()).updatedAt;
        await iris.put(`${mine(timetable)}/setup`).send({ taking: Object.values(ids) });
        await iris.put(onClass(timetable, ids.Ethics)).send({ choice: 'hidden' });
        expect((await scheduleModel.findById(timetable._id).lean()).updatedAt).toEqual(before);

        const [web] = named(await weekOf(iris), 'Web Systems');
        expect(web).toMatchObject({ myChoice: 'follow', notice: null, group: { _id: group._id, name: 'BSIT 3-1' } });
        expect(named(await weekOf(iris), 'Ethics')).toHaveLength(0);

        // "I take this" brings it back.
        await iris.put(onClass(timetable, ids.Ethics)).send({ choice: 'follow' });
        expect(named(await weekOf(iris), 'Ethics')).toHaveLength(1);
    });

    test('running the checklist again follows a class ticked again and keeps a ticked customized one', async () => {
        const { cy, timetable, ids } = await setup();
        await cy.put(`${mine(timetable)}/setup`).send({ taking: [ids['Web Systems']] });
        await customize(cy, timetable, ids['Web Systems']);
        await cy.put(`${mine(timetable)}/setup`).send({ taking: [ids['Web Systems'], ids.Database] });
        const { schedule } = (await cy.get(base(timetable))).body;
        const choiceOf = Object.fromEntries(schedule.entries.map((e) => [e.title, e.myChoice]));
        expect(choiceOf).toEqual({ 'Web Systems': 'custom', Networking: 'hidden', Database: 'follow', Ethics: 'hidden' });
    });

    test('bad bodies are refused', async () => {
        const { iris, timetable, ids } = await setup();
        expect((await iris.put(`${mine(timetable)}/setup`).send({ taking: 'all' })).status).toBe(400);
        expect((await iris.put(onClass(timetable, ids.Ethics)).send({ choice: 'custom' })).status).toBe(400);
    });
});

describe('customize mine', () => {
    test("Cy's copy goes in his own main, linked to a subject made for it; his week shows it once; his move stays his", async () => {
        const { bob, cy, timetable, ids } = await setup();
        await Promise.all([countIt(bob, timetable), countIt(cy, timetable)]);

        const made = await customize(cy, timetable, ids['Web Systems']);
        const main = await mainOf(cy);
        expect(made.scheduleId).toBe(String(main._id));
        const copy = main.entries.find((e) => String(e._id) === made.entryId);
        const subject = await subjectModel.findOne({ owner: cy.id, name: 'Web Systems' }).lean();
        expect(subject).toBeTruthy();
        expect(copy).toMatchObject({ title: 'Web Systems', kind: 'class', days: [1], startTime: '08:00' });
        expect(String(copy.subject)).toBe(String(subject._id));

        const webs = named(await weekOf(cy), 'Web Systems');
        expect(webs).toHaveLength(1);
        expect(webs[0]).toMatchObject({
            scheduleId: String(main._id), canEdit: true, myChoice: 'custom', notice: null,
            customOf: { scheduleId: String(timetable._id), entryId: ids['Web Systems'] },
        });

        await moveClass(cy, main._id, made.entryId, 'Web Systems', { startTime: '09:00', endTime: '11:00' });
        expect(named(await weekOf(cy), 'Web Systems')[0].startTime).toBe('09:00');
        expect(named(await weekOf(bob), 'Web Systems')[0].startTime).toBe('08:00');
    });

    test('a retry makes no second copy, and a subject Cy already has is reused', async () => {
        const { cy, timetable, ids } = await setup();
        const networking = (await cy.post('/api/subjects').send({ name: 'Networking' })).body.subject;
        const first = await customize(cy, timetable, ids.Networking);
        const again = await cy.post(`${onClass(timetable, ids.Networking)}/customize`);
        expect(again.status).toBe(200);
        expect(again.body.entryId).toBe(first.entryId);

        const main = await mainOf(cy);
        expect(named(main.entries, 'Networking')).toHaveLength(1);
        expect(String(named(main.entries, 'Networking')[0].subject)).toBe(networking._id);
        expect(await subjectModel.countDocuments({ owner: cy.id })).toBe(1);
    });

    test('two customizes at the same moment make one copy', async () => {
        const { cy, timetable, ids } = await setup();
        await cy.post('/api/schedules').send({ title: 'My timetable' });
        const answers = await Promise.all([1, 2].map(() => cy.post(`${onClass(timetable, ids.Ethics)}/customize`)));
        expect(answers.every((r) => r.status === 201 || r.status === 200)).toBe(true);
        expect(named((await mainOf(cy)).entries, 'Ethics')).toHaveLength(1);
        expect((await choiceDoc(cy, timetable)).choices).toHaveLength(1);
    });

    test('a customize after the choice was lost reuses the identical class already in his timetable', async () => {
        const { cy, timetable, ids } = await setup();
        await customize(cy, timetable, ids.Database);
        await classChoiceModel.deleteMany({ user: cy.id });
        await customize(cy, timetable, ids.Database);
        expect(named((await mainOf(cy)).entries, 'Database')).toHaveLength(1);
    });

    test('"Make it all mine" copies every followed class in one go', async () => {
        const { cy, timetable, ids } = await setup();
        await countIt(cy, timetable);
        await cy.put(onClass(timetable, ids.Ethics)).send({ choice: 'hidden' });
        const res = await cy.post(`${mine(timetable)}/customize-all`);
        expect(res.status).toBe(201);
        expect(res.body.customized).toBe(3);
        const main = await mainOf(cy);
        expect(titles(main.entries)).toEqual(['Database', 'Networking', 'Web Systems']);
        const week = await weekOf(cy);
        expect(titles(week)).toEqual(['Database', 'Networking', 'Web Systems']);
        expect(week.every((e) => e.scheduleId === String(main._id))).toBe(true);
        expect((await cy.post(`${mine(timetable)}/customize-all`)).body.customized).toBe(0);
    });

    test('an admin who saved Just for me with Count off still gets the layer marks on her copy, and one who left gets none', async () => {
        const { ann, cy, group, timetable, ids } = await setup();
        for (const agent of [ann, cy]) await customize(agent, timetable, ids['Web Systems']);

        const [copy] = named(await weekOf(ann), 'Web Systems');
        expect(copy).toMatchObject({
            myChoice: 'custom', notice: null,
            customOf: { scheduleId: String(timetable._id), entryId: ids['Web Systems'] },
            group: { _id: String(group._id), name: 'BSIT 3-1' },
        });
        expect(titles(await weekOf(ann))).toEqual(['Web Systems']);

        // Cy leaves the group; a choice left behind must not decorate his now plain class.
        const saved = await choiceDoc(cy, timetable);
        await cy.post('/api/groups/leave').send({ groupId: group._id });
        await classChoiceModel.create({ user: cy.id, schedule: timetable._id, choices: saved.choices });
        const [left] = named(await weekOf(cy), 'Web Systems');
        expect(left.myChoice).toBeUndefined();
        expect(left.customOf).toBeUndefined();
    });

    test('at 30 subjects, customizing a class with no subject of that name answers the cap and copies nothing', async () => {
        const { cy, timetable, ids } = await setup();
        await subjectModel.insertMany(Array.from({ length: 30 }, (_, i) => ({ owner: cy.id, name: `Subject ${i}`, order: i })));
        const res = await cy.post(`${onClass(timetable, ids['Web Systems'])}/customize`);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/up to 30 subjects/);
        expect(await scheduleModel.countDocuments({ owner: cy.id })).toBe(0);
        expect(await choiceDoc(cy, timetable)).toBeNull();
        expect(await subjectModel.countDocuments({ owner: cy.id })).toBe(30);
    });

    test("deleting Cy's Web Systems subject pulls his copy, and the group class stays hidden for him", async () => {
        // Archiving (plan 40 T1) isn't built yet; a deleted subject takes its classes the same way.
        const { cy, timetable, ids } = await setup();
        await countIt(cy, timetable);
        await customize(cy, timetable, ids['Web Systems']);
        const subject = await subjectModel.findOne({ owner: cy.id, name: 'Web Systems' }).lean();
        expect((await cy.delete(`/api/subjects/${subject._id}`)).status).toBe(200);

        expect(named((await mainOf(cy)).entries, 'Web Systems')).toHaveLength(0);
        expect(named(await weekOf(cy), 'Web Systems')).toHaveLength(0);
        expect((await sharedEntry(cy, timetable, ids['Web Systems']))).toMatchObject({ myChoice: 'hidden', notice: null });
    });
});

describe('an admin changes the class for everyone', () => {
    // Bob follows everything, Iris hid Web Systems, Cy customized it and moved his copy to 9:00.
    const withChoices = async () => {
        const people = await setup();
        const { bob, iris, cy, timetable, ids } = people;
        await countIt(bob, timetable);
        await iris.put(`${mine(timetable)}/setup`).send({ taking: [ids.Networking, ids.Database, ids.Ethics] });
        await countIt(cy, timetable);
        const copy = await customize(cy, timetable, ids['Web Systems']);
        await moveClass(cy, copy.scheduleId, copy.entryId, 'Web Systems', { startTime: '09:00', endTime: '11:00' });
        await notificationModel.deleteMany({});
        return { ...people, copy };
    };

    test('a move reaches followers with the usual line, Cy with his own line and a notice, and Iris not at all', async () => {
        const { ann, bob, iris, cy, timetable, ids, group } = await withChoices();
        const moved = await moveClass(ann, timetable._id, ids['Web Systems'], 'Web Systems', { startTime: '07:00', endTime: '09:00' });
        expect(moved.status).toBe(200);

        expect(named(await weekOf(bob), 'Web Systems')[0].startTime).toBe('07:00');
        const bobLines = await changeLines(bob);
        expect(bobLines).toHaveLength(1);
        expect(bobLines[0].message).toBe('Ann edited "Web Systems"');

        expect(await changeLines(iris)).toHaveLength(0);
        expect(named(await weekOf(iris), 'Web Systems')).toHaveLength(0);

        const cyWeb = named(await weekOf(cy), 'Web Systems');
        expect(cyWeb).toHaveLength(1);
        expect(cyWeb[0]).toMatchObject({ startTime: '09:00', notice: 'changed' });
        expect(await sharedEntry(cy, timetable, ids['Web Systems'])).toMatchObject({ myChoice: 'custom', notice: 'changed' });
        const cyLines = await changeLines(cy);
        expect(cyLines).toHaveLength(1);
        expect(cyLines[0].message).toBe('Ann changed "Web Systems" for everyone. Your own time for it stays as it is.');
        expect((await myClasses(cy, group)).classes).toEqual([expect.objectContaining({
            entryId: ids['Web Systems'], title: 'Web Systems', myChoice: 'custom', notice: 'changed',
        })]);
    });

    test("Keep mine clears Cy's notice; Use the group's deletes his copy and he follows 7:00", async () => {
        const { ann, cy, timetable, ids, copy } = await withChoices();
        await moveClass(ann, timetable._id, ids['Web Systems'], 'Web Systems', { startTime: '07:00', endTime: '09:00' });

        const kept = await cy.post(`${onClass(timetable, ids['Web Systems'])}/keep-mine`);
        expect(kept.status).toBe(200);
        expect(kept.body.myClasses.classes[0]).toMatchObject({ myChoice: 'custom', notice: null });
        expect(named(await weekOf(cy), 'Web Systems')[0]).toMatchObject({ startTime: '09:00', notice: null });

        const back = await cy.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'follow' });
        expect(back.status).toBe(200);
        expect(back.body.myClasses.classes).toEqual([]);
        expect((await mainOf(cy)).entries.some((e) => String(e._id) === copy.entryId)).toBe(false);
        const webs = named(await weekOf(cy), 'Web Systems');
        expect(webs).toHaveLength(1);
        expect(webs[0]).toMatchObject({ startTime: '07:00', scheduleId: String(timetable._id), myChoice: 'follow' });
    });

    test('a change that leaves the class as Cy customized it sends him nothing', async () => {
        const { ann, cy, timetable, ids } = await withChoices();
        await ann.put(`${base(timetable)}/entries/${ids['Web Systems']}`).send(classBody({ title: 'Web Systems', days: [1], notes: 'Bring a laptop' }));
        expect(await changeLines(cy)).toHaveLength(0);
        expect((await sharedEntry(cy, timetable, ids['Web Systems'])).notice).toBeNull();
    });

    test('a delete: Bob loses it, Cy keeps his copy with a removed notice; Remove mine and Keep mine', async () => {
        const { ann, bob, cy, timetable, ids, group, copy } = await withChoices();
        const netCopy = await customize(cy, timetable, ids.Networking);
        await notificationModel.deleteMany({});
        expect((await ann.delete(`${base(timetable)}/entries/${ids['Web Systems']}`)).status).toBe(200);
        expect((await ann.delete(`${base(timetable)}/entries/${ids.Networking}`)).status).toBe(200);

        expect(named(await weekOf(bob), 'Web Systems')).toHaveLength(0);
        const cyWeb = named(await weekOf(cy), 'Web Systems');
        expect(cyWeb).toHaveLength(1);
        expect(cyWeb[0]).toMatchObject({ entryId: copy.entryId, notice: 'removed' });
        expect((await changeLines(cy)).map((n) => n.message)).toContain('Ann removed "Web Systems". Yours is still in your timetable.');
        const listed = (await myClasses(cy, group)).classes;
        expect(listed).toEqual(expect.arrayContaining([
            expect.objectContaining({ entryId: ids['Web Systems'], title: 'Web Systems', notice: 'removed', copy: { scheduleId: copy.scheduleId, entryId: copy.entryId } }),
            expect.objectContaining({ entryId: ids.Networking, notice: 'removed' }),
        ]));

        // Remove mine: the copy goes.
        expect((await cy.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'follow' })).status).toBe(200);
        expect(named(await weekOf(cy), 'Web Systems')).toHaveLength(0);
        // Keep mine: the copy stays as a plain class with no choice.
        const kept = await cy.post(`${onClass(timetable, ids.Networking)}/keep-mine`);
        expect(kept.status).toBe(200);
        expect(kept.body.myClasses.classes).toEqual([]);
        const net = named(await weekOf(cy), 'Networking');
        expect(net).toHaveLength(1);
        expect(net[0].entryId).toBe(netCopy.entryId);
        expect(net[0].myChoice).toBeUndefined();
        // A removed class can't be hidden or customized.
        expect((await cy.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'hidden' })).status).toBe(404);
        expect((await cy.post(`${onClass(timetable, ids['Web Systems'])}/customize`)).status).toBe(404);
    });

    test('a class an admin adds reaches Bob, Iris and Cy at once', async () => {
        const { ann, bob, iris, cy, timetable } = await withChoices();
        expect((await ann.post(`${base(timetable)}/entries`).send(classBody({ title: 'Lab', days: [5], startTime: '13:00', endTime: '16:00' }))).status).toBe(201);
        for (const member of [bob, iris, cy]) expect(named(await weekOf(member), 'Lab')).toHaveLength(1);
    });

    test('editors see how many members use their own time for a class, never who', async () => {
        const { ann, bob, cy, timetable, ids } = await withChoices();
        const web = await sharedEntry(ann, timetable, ids['Web Systems']);
        expect(web.ownTimeCount).toBe(1);
        expect((await sharedEntry(ann, timetable, ids.Networking)).ownTimeCount).toBe(0);
        expect((await sharedEntry(bob, timetable, ids['Web Systems'])).ownTimeCount).toBeUndefined();
        // Nothing in the timetable names who customized it.
        const { schedule } = (await ann.get(base(timetable))).body;
        expect(JSON.stringify(schedule.entries)).not.toContain(cy.id);
    });
});

describe('leaving', () => {
    test("Bob leaves: no group classes in his week and his choices are gone", async () => {
        const { bob, group, timetable, ids } = await setup();
        await bob.put(`${mine(timetable)}/setup`).send({ taking: [ids['Web Systems']] });
        expect(await choiceDoc(bob, timetable)).toBeTruthy();
        await bob.post('/api/groups/leave').send({ groupId: group._id });
        expect(await choiceDoc(bob, timetable)).toBeNull();
        expect((await weekOf(bob)).some((e) => e.scheduleId === String(timetable._id))).toBe(false);
    });

    test('Cy removed by Ann: his copies stay his own classes and he hears nothing more', async () => {
        const { ann, cy, group, timetable, ids } = await setup();
        await countIt(cy, timetable);
        const copy = await customize(cy, timetable, ids['Web Systems']);
        expect((await ann.delete(`/api/groups/${group._id}/members/${cy.id}`)).status).toBe(200);
        expect(await choiceDoc(cy, timetable)).toBeNull();

        await notificationModel.deleteMany({});
        await moveClass(ann, timetable._id, ids['Web Systems'], 'Web Systems', { startTime: '07:00', endTime: '09:00' });
        expect(await changeLines(cy)).toHaveLength(0);
        const webs = named(await weekOf(cy), 'Web Systems');
        expect(webs).toHaveLength(1);
        expect(webs[0]).toMatchObject({ entryId: copy.entryId, startTime: '08:00' });
        expect(webs[0].myChoice).toBeUndefined();
    });

    test('deleting the group or its timetable takes everyone\'s choices along', async () => {
        const { alice, iris, cy, group, timetable, ids } = await setup();
        await iris.put(`${mine(timetable)}/setup`).send({ taking: [] });
        await customize(cy, timetable, ids.Ethics);
        expect(await classChoiceModel.countDocuments({ schedule: timetable._id })).toBe(2);
        expect((await alice.delete(base(timetable))).status).toBe(200);
        expect(await classChoiceModel.countDocuments({})).toBe(0);
        expect(named((await mainOf(cy)).entries, 'Ethics')).toHaveLength(1);

        const again = (await alice.post(`/api/groups/${group._id}/timetable`)).body.timetable;
        await alice.post(`${base(again)}/entries`).send(classBody({ title: 'Ethics', days: [4] }));
        await iris.put(`${mine(again)}/setup`).send({ taking: [] });
        expect(await classChoiceModel.countDocuments({})).toBe(1);
        await alice.delete(`/api/groups/${group._id}`);
        expect(await classChoiceModel.countDocuments({})).toBe(0);
    });
});

describe('publishing my version', () => {
    test("Ann (an admin) customizes, moves her copy and publishes it: the group class takes her times, her copy and choice go", async () => {
        const { ann, bob, timetable, ids } = await setup();
        await countIt(bob, timetable);
        const copy = await customize(ann, timetable, ids['Web Systems']);
        await moveClass(ann, copy.scheduleId, copy.entryId, 'Web Systems', { startTime: '13:00', endTime: '15:00', location: 'Lab 2' }, [1, 3]);

        const res = await ann.post(`${onClass(timetable, ids['Web Systems'])}/publish`);
        expect(res.status).toBe(200);
        expect(res.body.myClasses.classes).toEqual([]);
        const shared = (await scheduleModel.findById(timetable._id).lean()).entries.find((e) => String(e._id) === ids['Web Systems']);
        expect(shared).toMatchObject({ startTime: '13:00', endTime: '15:00', days: [1, 3], location: 'Lab 2' });
        expect(named((await mainOf(ann)).entries, 'Web Systems')).toHaveLength(0);
        expect(await choiceDoc(ann, timetable)).toMatchObject({ choices: [] });
        expect(named(await weekOf(bob), 'Web Systems').map((e) => e.startTime)).toEqual(['13:00', '13:00']);
        expect((await changeLines(bob)).map((n) => n.message).join()).toContain('Ann edited "Web Systems"');
    });

    test('publishing after Alice moved the class meanwhile is a 409 and changes nothing', async () => {
        const { alice, ann, timetable, ids } = await setup();
        const copy = await customize(ann, timetable, ids.Networking);
        await moveClass(alice, timetable._id, ids.Networking, 'Networking', { startTime: '10:00', endTime: '12:00' }, [2]);
        const res = await ann.post(`${onClass(timetable, ids.Networking)}/publish`);
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('This class changed since you customized it.');
        const shared = (await scheduleModel.findById(timetable._id).lean()).entries.find((e) => String(e._id) === ids.Networking);
        expect(shared.startTime).toBe('10:00');
        expect((await mainOf(ann)).entries.some((e) => String(e._id) === copy.entryId)).toBe(true);
    });
});

describe('who can use the layer routes', () => {
    test('Bob (a viewer) can customize but not publish', async () => {
        const { bob, timetable, ids } = await setup();
        await customize(bob, timetable, ids['Web Systems']);
        expect((await bob.post(`${onClass(timetable, ids['Web Systems'])}/publish`)).status).toBe(403);
    });

    test('Carol, who is not on it, gets 404 on every layer route', async () => {
        const { carol, timetable, ids } = await setup();
        const id = ids['Web Systems'];
        const answers = await Promise.all([
            carol.put(`${mine(timetable)}/setup`).send({ taking: [] }),
            carol.post(`${mine(timetable)}/customize-all`),
            carol.put(onClass(timetable, id)).send({ choice: 'hidden' }),
            carol.post(`${onClass(timetable, id)}/customize`),
            carol.post(`${onClass(timetable, id)}/keep-mine`),
            carol.post(`${onClass(timetable, id)}/publish`),
        ]);
        expect(answers.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404]);
        expect(await classChoiceModel.countDocuments({})).toBe(0);
    });

    test("Bob's choices are his own: he can't see or change Iris's", async () => {
        const { bob, iris, timetable, ids } = await setup();
        await iris.put(`${mine(timetable)}/setup`).send({ taking: [ids['Web Systems']] });
        expect((await sharedEntry(bob, timetable, ids.Ethics)).myChoice).toBe('follow');
        await bob.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'hidden' });
        expect((await sharedEntry(iris, timetable, ids['Web Systems'])).myChoice).toBe('follow');
        expect((await sharedEntry(iris, timetable, ids.Ethics)).myChoice).toBe('hidden');
        expect((await sharedEntry(bob, timetable, ids.Ethics)).myChoice).toBe('follow');
    });

    test('the owner of a personal timetable has no layer on it; a class from another timetable is 404', async () => {
        const { alice, bob, timetable } = await setup();
        const own = (await alice.post('/api/schedules').send({ title: 'Mine' })).body.schedule;
        const entry = (await alice.post(`${base(own)}/entries`).send(classBody({ title: 'Gym', days: [6] }))).body.schedule.entries[0];
        expect((await alice.put(`${mine(own)}/setup`).send({ taking: [] })).status).toBe(400);
        expect((await alice.post(`${onClass(own, entry._id)}/customize`)).status).toBe(400);
        expect((await bob.post(`${onClass(timetable, entry._id)}/customize`)).status).toBe(404);
        expect((await bob.put(onClass(timetable, 'not-an-id')).send({ choice: 'hidden' })).status).toBe(404);
    });

    test('the group owner has a layer too, as a member', async () => {
        const { alice, timetable, ids } = await setup();
        const res = await alice.put(`${mine(timetable)}/setup`).send({ taking: [ids['Web Systems']] });
        expect(res.status).toBe(200);
        expect(titles(await weekOf(alice))).toEqual(['Web Systems']);
    });

    test('layer writes share the group-plan limit of 60 a minute', async () => {
        const { bob, timetable, ids } = await setup();
        for (let i = 0; i < 60; i += 1) await bob.put(onClass(timetable, ids.Ethics)).send({ choice: i % 2 ? 'follow' : 'hidden' });
        expect((await bob.put(onClass(timetable, ids.Ethics)).send({ choice: 'hidden' })).status).toBe(429);
    });
});

describe("a friend's shared timetable", () => {
    test('Fay (viewer) can take some classes, hide, customize and get notices, and Alice has no layer on her own', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const fay = await signUp('fay@student.fatima.edu.ph', 'Fay');
        await Friend.create({ user: alice.id, friend: fay.id, status: 'accepted' });
        const own = (await alice.post('/api/schedules').send({ title: 'My classes' })).body.schedule;
        for (const c of CLASSES.slice(0, 3)) await alice.post(`${base(own)}/entries`).send(classBody(c));
        expect((await alice.post(`${base(own)}/share`).send({ userId: fay.id, role: 'viewer' })).status).toBe(200);
        const ids = Object.fromEntries((await scheduleModel.findById(own._id).lean()).entries.map((e) => [e.title, String(e._id)]));

        expect((await fay.put(`${mine(own)}/setup`).send({ taking: [ids['Web Systems'], ids.Networking] })).status).toBe(200);
        expect(titles(await weekOf(fay))).toEqual(['Networking', 'Web Systems']);
        await fay.put(onClass(own, ids.Networking)).send({ choice: 'hidden' });
        expect(titles(await weekOf(fay))).toEqual(['Web Systems']);

        const copy = await customize(fay, own, ids['Web Systems']);
        expect(named(await weekOf(fay), 'Web Systems')[0].scheduleId).toBe(copy.scheduleId);

        await moveClass(alice, own._id, ids['Web Systems'], 'Web Systems', { startTime: '07:00', endTime: '09:00' });
        expect(await sharedEntry(fay, own, ids['Web Systems'])).toMatchObject({ myChoice: 'custom', notice: 'changed' });
        expect(named(await weekOf(fay), 'Web Systems')[0]).toMatchObject({ startTime: '08:00', notice: 'changed' });

        expect((await alice.put(`${mine(own)}/setup`).send({ taking: [] })).status).toBe(400);

        // Removed from it: her choices go, her copy stays.
        await alice.delete(`${base(own)}/share/${fay.id}`);
        expect(await choiceDoc(fay, own)).toBeNull();
        expect(named((await mainOf(fay)).entries, 'Web Systems')).toHaveLength(1);
    });
});

describe('everyone else', () => {
    test('a student with no shared timetables gets plain week entries, with no layer fields', async () => {
        const dan = await signUp('dan@student.fatima.edu.ph', 'Dan');
        await dan.post('/api/schedules/main/entries').send(classBody({ title: 'Web Systems', days: [1] }));
        const week = await weekOf(dan);
        expect(week).toHaveLength(1);
        for (const key of ['myChoice', 'notice', 'group', 'customOf']) expect(week[0]).not.toHaveProperty(key);
    });

    test("a group whose owner is its only admin still logs changes and tells the members", async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        const { group } = (await alice.post('/api/groups').send({ name: 'Study buddies' })).body;
        await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
        const timetable = (await alice.post(`/api/groups/${group._id}/timetable`)).body.timetable;
        await alice.post(`${base(timetable)}/entries`).send(classBody({ title: 'Ethics', days: [4] }));

        const stored = await scheduleModel.findById(timetable._id).lean();
        expect(stored.activity).toHaveLength(1);
        expect((await changeLines(bob)).map((n) => n.message)).toEqual(['Alice added "Ethics"']);
        expect((await bob.get(base(timetable))).body.schedule.live).toBe(true);
    });
});

describe('copies are marked, and only marked copies are ever reused or removed', () => {
    test("Cy's own identical class stays his: customize adds a marked copy, Use the group's removes only that", async () => {
        const { cy, timetable, ids } = await setup();
        await countIt(cy, timetable);
        const own = (await cy.post('/api/schedules/main/entries').send(classBody({ title: 'Web Systems', days: [1] }))).body.schedule.entries[0];
        const copy = await customize(cy, timetable, ids['Web Systems']);
        expect(copy.entryId).not.toBe(String(own._id));
        const webs = named((await mainOf(cy)).entries, 'Web Systems');
        expect(webs).toHaveLength(2);
        expect(String(webs.find((e) => String(e._id) === copy.entryId).copyOf)).toBe(ids['Web Systems']);
        expect(webs.find((e) => String(e._id) === String(own._id)).copyOf).toBeNull();
        // The week counts the same class once.
        expect(named(await weekOf(cy), 'Web Systems')).toHaveLength(1);

        await cy.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'follow' });
        const left = named((await mainOf(cy)).entries, 'Web Systems');
        expect(left.map((e) => String(e._id))).toEqual([String(own._id)]);
    });

    test('a choice pointing at an unmarked class never deletes it', async () => {
        const { cy, timetable, ids } = await setup();
        const own = (await cy.post('/api/schedules/main/entries').send(classBody({ title: 'Ethics', days: [4] }))).body.schedule.entries[0];
        const main = await mainOf(cy);
        // A choice that (wrongly) names Cy's own class as its copy.
        await classChoiceModel.create({
            schedule: timetable._id,
            user: cy.id,
            choices: [{
                entry: ids.Ethics, choice: 'custom', copy: { schedule: main._id, entry: own._id },
                base: { days: [4], startTime: '08:00', endTime: '10:00' },
            }],
        });
        await cy.put(onClass(timetable, ids.Ethics)).send({ choice: 'follow' });
        expect(named((await mainOf(cy)).entries, 'Ethics')).toHaveLength(1);
    });

    test('"Not taking this" on a customized class removes the copy, and so does unticking it in the checklist', async () => {
        const { cy, timetable, ids } = await setup();
        await countIt(cy, timetable);
        await customize(cy, timetable, ids['Web Systems']);
        await customize(cy, timetable, ids.Networking);

        await cy.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'hidden' });
        expect(named((await mainOf(cy)).entries, 'Web Systems')).toHaveLength(0);
        expect((await sharedEntry(cy, timetable, ids['Web Systems'])).myChoice).toBe('hidden');

        await cy.put(`${mine(timetable)}/setup`).send({ taking: [ids.Database, ids.Ethics] });
        expect(named((await mainOf(cy)).entries, 'Networking')).toHaveLength(0);
        expect(titles(await weekOf(cy))).toEqual(['Database', 'Ethics']);
    });
});

describe('a refused customize writes nothing', () => {
    test('a full main timetable (80 entries) refuses with the cap message, and no subject is made', async () => {
        const { cy, timetable, ids } = await setup();
        const main = (await cy.post('/api/schedules').send({ title: 'My timetable' })).body.schedule;
        const slots = Array.from({ length: 80 }, (_, i) => ({ title: `Slot ${i}`, kind: 'activity', days: [0], startTime: '06:00', endTime: '07:00' }));
        await scheduleModel.updateOne({ _id: main._id }, { $push: { entries: { $each: slots } } });

        const answers = [
            await cy.post(`${onClass(timetable, ids['Web Systems'])}/customize`),
            await cy.post(`${mine(timetable)}/customize-all`),
        ];
        for (const res of answers) {
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('A schedule can hold up to 80 entries.');
        }
        expect(await subjectModel.countDocuments({ owner: cy.id })).toBe(0);
        expect(await choiceDoc(cy, timetable)).toBeNull();
        expect((await mainOf(cy)).entries).toHaveLength(80);
    });
});

describe('customizes at the same moment', () => {
    const copiesIn = async (agent) => (await mainOf(agent)).entries.filter((e) => e.copyOf);

    test('three "Make it all mine" at once give exactly 4 subjects and 4 copies', async () => {
        const { cy, timetable } = await setup();
        const answers = await Promise.all([1, 2, 3].map(() => cy.post(`${mine(timetable)}/customize-all`)));
        expect(answers.every((r) => [200, 201].includes(r.status))).toBe(true);
        expect(await subjectModel.countDocuments({ owner: cy.id })).toBe(4);
        expect(await copiesIn(cy)).toHaveLength(4);
        expect((await choiceDoc(cy, timetable)).choices).toHaveLength(4);
    });

    test('customizing four different classes at once gives 4 subjects, 4 copies and 4 choices', async () => {
        const { cy, timetable, ids } = await setup();
        const answers = await Promise.all(Object.values(ids).map((id) => cy.post(`${onClass(timetable, id)}/customize`)));
        expect(answers.map((r) => r.status)).toEqual([201, 201, 201, 201]);
        expect(await subjectModel.countDocuments({ owner: cy.id })).toBe(4);
        expect(await copiesIn(cy)).toHaveLength(4);
        expect((await choiceDoc(cy, timetable)).choices).toHaveLength(4);
    });
});

describe('publishing, counting and cleanup details', () => {
    test('publish works on a class saved without a meeting link field', async () => {
        const { ann, timetable, ids } = await setup();
        await scheduleModel.updateOne({ _id: timetable._id }, { $unset: { 'entries.$[].meetingUrl': '' } });
        const copy = await customize(ann, timetable, ids.Database);
        await moveClass(ann, copy.scheduleId, copy.entryId, 'Database', { startTime: '15:00', endTime: '17:00' }, [3]);
        expect((await ann.post(`${onClass(timetable, ids.Database)}/publish`)).status).toBe(200);
        const shared = (await scheduleModel.findById(timetable._id).lean()).entries.find((e) => String(e._id) === ids.Database);
        expect(shared.startTime).toBe('15:00');
    });

    test('who hears about a publish: followers the usual line, the customizer his own, the one who hid it and the publisher nothing', async () => {
        const { alice, ann, bob, iris, cy, timetable, ids } = await setup();
        await iris.put(onClass(timetable, ids['Web Systems'])).send({ choice: 'hidden' });
        await customize(cy, timetable, ids['Web Systems']);
        const copy = await customize(ann, timetable, ids['Web Systems']);
        await moveClass(ann, copy.scheduleId, copy.entryId, 'Web Systems', { startTime: '13:00', endTime: '15:00' });
        await notificationModel.deleteMany({});

        expect((await ann.post(`${onClass(timetable, ids['Web Systems'])}/publish`)).status).toBe(200);
        const lines = async (agent) => (await changeLines(agent)).map((n) => n.message);
        expect(await lines(alice)).toEqual(['Ann edited "Web Systems"']);
        expect(await lines(bob)).toEqual(['Ann edited "Web Systems"']);
        expect(await lines(cy)).toEqual(['Ann changed "Web Systems" for everyone. Your own time for it stays as it is.']);
        expect(await lines(iris)).toEqual([]);
        expect(await lines(ann)).toEqual([]);
    });

    test('a copy the member deleted no longer counts as using their own time', async () => {
        const { ann, cy, timetable, ids } = await setup();
        const copy = await customize(cy, timetable, ids['Web Systems']);
        expect((await sharedEntry(ann, timetable, ids['Web Systems'])).ownTimeCount).toBe(1);
        expect((await cy.delete(`/api/schedules/${copy.scheduleId}/entries/${copy.entryId}`)).status).toBe(200);
        expect((await sharedEntry(ann, timetable, ids['Web Systems'])).ownTimeCount).toBe(0);
    });

    test("a group timetable the sync drops (its group is gone) takes the members' choices along", async () => {
        const { iris, group, timetable } = await setup();
        await iris.put(`${mine(timetable)}/setup`).send({ taking: [] });
        await groupModel.deleteOne({ _id: group._id });
        await syncGroupTimetable(group._id);
        expect(await scheduleModel.exists({ _id: timetable._id })).toBeNull();
        expect(await classChoiceModel.countDocuments({})).toBe(0);
    });

    test("making a shared timetable private drops everyone's choices on it", async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const fay = await signUp('fay@student.fatima.edu.ph', 'Fay');
        await Friend.create({ user: alice.id, friend: fay.id, status: 'accepted' });
        const own = (await alice.post('/api/schedules').send({ title: 'My classes' })).body.schedule;
        await alice.post(`${base(own)}/entries`).send(classBody(CLASSES[0]));
        await alice.post(`${base(own)}/share`).send({ userId: fay.id, role: 'viewer' });
        await fay.put(`${mine(own)}/setup`).send({ taking: [] });
        expect(await classChoiceModel.countDocuments({})).toBe(1);
        expect((await alice.post(`${base(own)}/make-private`)).status).toBe(200);
        expect(await classChoiceModel.countDocuments({})).toBe(0);
    });
});

describe('duplicating a timetable', () => {
    test("a duplicate carries no copy marks, so it can't pass for someone else's customized class", async () => {
        const { bob, timetable, ids } = await setup();
        await customize(bob, timetable, ids['Web Systems']);
        const main = await mainOf(bob);
        expect(main.entries.some((e) => e.copyOf)).toBe(true);

        const res = await bob.post(`/api/schedules/${main._id}/duplicate`);
        expect(res.status).toBe(201);
        const copy = await scheduleModel.findById(res.body.schedule._id).lean();
        expect(copy.entries.length).toBeGreaterThan(0);
        expect(copy.entries.some((e) => e.copyOf)).toBe(false);
    });
});
