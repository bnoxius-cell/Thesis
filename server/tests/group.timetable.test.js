import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import scheduleModel, { MAX_OWNED_SCHEDULES } from '../models/scheduleModel.js';
import groupModel from '../models/groupMode.js';
import subjectModel from '../models/subjectModel.js';
import notificationModel from '../models/notificationModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { syncGroupTimetable } from '../utils/groupPlan.js';

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
    vi.restoreAllMocks();
});
afterAll(closeTestDB);

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

// alice owns the group, ann is an admin, bob is a member, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const ann = await signUp('ann@student.fatima.edu.ph', 'Ann');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');

    const { group } = (await alice.post('/api/groups').send({ name: 'BSIT 3-1' })).body;
    await ann.post('/api/groups/join').send({ joinCode: group.joinCode });
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    await alice.post(`/api/groups/${group._id}/admins`).send({ userId: ann.id });
    return { alice, ann, bob, carol, group };
};

// setup plus the group's timetable, made by the owner.
const setupWithTimetable = async () => {
    const people = await setup();
    const created = await createTimetable(people.alice, people.group);
    return { ...people, timetable: created.body.timetable };
};

const webClass = (overrides = {}) => ({
    title: 'Web Systems', kind: 'class', days: [1], startTime: '08:00', endTime: '10:00', ...overrides,
});

const createTimetable = (agent, group) => agent.post(`/api/groups/${group._id}/timetable`);
const plan = (agent, group) => agent.get(`/api/groups/${group._id}/plan`);
const planStamp = (agent, group) => agent.get(`/api/groups/${group._id}/plan/stamp`);
const base = (timetable) => `/api/schedules/${timetable._id}`;
const roleOn = async (agent, timetable) => (await agent.get(base(timetable))).body.schedule?.role;
const stored = (timetable) => scheduleModel.findById(timetable._id).lean();
const collaboratorOf = async (timetable, agent) => (await stored(timetable)).collaborators.find((c) => String(c.user) === agent.id);
const makeSubject = async (agent, name) => (await agent.post('/api/subjects').send({ name })).body.subject;

describe('making the group timetable', () => {
    test('the owner makes it: owned by them, not main, not counted, everyone else on it by plan role', async () => {
        const { alice, ann, bob, group } = await setup();
        const created = await createTimetable(alice, group);
        expect(created.status).toBe(201);
        expect(created.body.timetable).toMatchObject({
            title: 'BSIT 3-1', role: 'owner', isMain: false, countInWorkload: false, entryCount: 0,
            group: { _id: group._id, name: 'BSIT 3-1' },
        });

        const timetable = await stored(created.body.timetable);
        expect(String(timetable.owner)).toBe(alice.id);
        expect(String(timetable.group)).toBe(group._id);
        expect(timetable.collaborators.map((c) => [String(c.user), c.role, c.countInWorkload]).sort()).toEqual([
            [ann.id, 'editor', false],
            [bob.id, 'viewer', false],
        ].sort());
    });

    test('an admin can make it too, and it still belongs to the group owner', async () => {
        const { alice, ann, group } = await setup();
        const created = await createTimetable(ann, group);
        expect(created.status).toBe(201);
        expect(created.body.timetable.role).toBe('editor');
        expect(String((await stored(created.body.timetable)).owner)).toBe(alice.id);
    });

    test('a second one is 409, a member gets 403 and an outsider 404', async () => {
        const { alice, ann, bob, carol, group } = await setup();
        expect((await createTimetable(bob, group)).status).toBe(403);
        expect((await createTimetable(carol, group)).status).toBe(404);
        expect((await createTimetable(alice, group)).status).toBe(201);

        const again = await createTimetable(ann, group);
        expect(again.status).toBe(409);
        expect(again.body.message).toBe('This group already has a timetable.');
        expect(await scheduleModel.countDocuments({ group: group._id })).toBe(1);
        expect((await createTimetable(alice, { _id: 'not-an-id' })).status).toBe(404);
    });

    test('the plan shows its summary and the stamp its last change', async () => {
        const { alice, bob, carol, group } = await setup();
        expect((await plan(bob, group)).body.timetable).toBeNull();
        expect((await planStamp(bob, group)).body.timetableAt).toBeNull();

        await createTimetable(alice, group);
        const view = (await plan(bob, group)).body.timetable;
        expect(view).toMatchObject({ title: 'BSIT 3-1', role: 'viewer', entryCount: 0, countInWorkload: false });
        expect(view.group.name).toBe('BSIT 3-1');
        expect((await planStamp(bob, group)).body.timetableAt).toBe(view.updatedAt);
        expect((await plan(carol, group)).status).toBe(404);
    });

    test('a group owner with the most personal timetables can still make it, and the cap is unchanged', async () => {
        const { alice, group } = await setup();
        for (let i = 0; i < MAX_OWNED_SCHEDULES; i += 1) {
            expect((await alice.post('/api/schedules').send({ title: `Mine ${i}` })).status).toBe(201);
        }
        expect((await createTimetable(alice, group)).status).toBe(201);
        expect((await alice.post('/api/schedules').send({ title: 'One too many' })).status).toBe(400);
    });

    test('with only the group timetable, the owner\'s first personal timetable becomes their main', async () => {
        const { alice, group, timetable } = await setupWithTimetable();
        expect((await alice.get('/api/schedules/main')).body.schedule).toBeNull();

        const mine = await alice.post('/api/schedules').send({ title: 'My week' });
        expect(mine.body.schedule.isMain).toBe(true);
        expect((await alice.get('/api/schedules/main')).body.schedule._id).toBe(mine.body.schedule._id);
        expect((await stored(timetable)).isMain).toBe(false);

        const list = (await alice.get('/api/schedules')).body.schedules;
        expect(list.find((s) => s._id === timetable._id)).toMatchObject({ isMain: false, group: { _id: group._id, name: 'BSIT 3-1' } });
        expect(list.find((s) => s._id === mine.body.schedule._id).group).toBeNull();
    });

    test('adding a class to "my timetable" never lands in the group timetable', async () => {
        const { alice, timetable } = await setupWithTimetable();
        const added = await alice.post('/api/schedules/main/entries').send(webClass());
        expect(added.status).toBe(201);
        expect(added.body.schedule._id).not.toBe(timetable._id);
        expect((await stored(timetable)).entries).toHaveLength(0);
    });
});

describe('editing the group timetable', () => {
    test('an admin is an editor: their change reaches the owner\'s stamp and notifies the others', async () => {
        const { alice, ann, bob, group, timetable } = await setupWithTimetable();
        expect(await roleOn(ann, timetable)).toBe('editor');
        const before = (await alice.get(`${base(timetable)}/stamp`)).body.updatedAt;
        const planBefore = (await planStamp(alice, group)).body.timetableAt;
        await new Promise((resolve) => { setTimeout(resolve, 5); });

        const added = await ann.post(`${base(timetable)}/entries`).send(webClass());
        expect(added.status).toBe(201);

        expect((await alice.get(`${base(timetable)}/stamp`)).body.updatedAt).not.toBe(before);
        expect((await planStamp(alice, group)).body.timetableAt).not.toBe(planBefore);
        for (const agent of [alice, bob]) {
            const changes = await notificationModel.find({ recipient: agent.id, type: 'schedule_change' });
            expect(changes).toHaveLength(1);
            expect(changes[0].message).toBe('Ann added "Web Systems"');
        }
        expect(await notificationModel.countDocuments({ recipient: ann.id, type: 'schedule_change' })).toBe(0);
    });

    test('a member is a viewer and can\'t add a class', async () => {
        const { bob, timetable } = await setupWithTimetable();
        expect(await roleOn(bob, timetable)).toBe('viewer');
        expect((await bob.post(`${base(timetable)}/entries`).send(webClass())).status).toBe(403);
    });

    test('admins may rename it; only the group owner changes owner settings or deletes it', async () => {
        const { alice, ann, bob, timetable } = await setupWithTimetable();
        const renamed = await ann.put(base(timetable)).send({ title: 'BSIT 3-1 classes', theme: 'ocean' });
        expect(renamed.status).toBe(200);
        expect(renamed.body.schedule).toMatchObject({ title: 'BSIT 3-1 classes', theme: 'ocean', role: 'editor' });

        expect((await ann.put(base(timetable)).send({ title: 'x', countInWorkload: true })).status).toBe(403);
        expect((await ann.put(base(timetable)).send({ editorsCanShare: true })).status).toBe(403);
        expect((await bob.put(base(timetable)).send({ title: 'Mine now' })).status).toBe(403);
        expect((await stored(timetable)).title).toBe('BSIT 3-1 classes');

        expect((await ann.delete(base(timetable))).status).toBe(403);
        expect((await alice.delete(base(timetable))).status).toBe(200);
        expect(await stored(timetable)).toBeNull();
    });

    test('an editor of an ordinary timetable still can\'t rename it', async () => {
        const { alice, ann } = await setup();
        const { schedule } = (await alice.post('/api/schedules').send({ title: 'Personal' })).body;
        await scheduleModel.updateOne({ _id: schedule._id }, { $push: { collaborators: { user: ann.id, role: 'editor' } } });
        const res = await ann.put(`/api/schedules/${schedule._id}`).send({ title: 'Renamed' });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Only the owner can do that');
    });

    test('a class stores no subject; each member reads their own subject of that name', async () => {
        const { alice, ann, bob, timetable } = await setupWithTimetable();
        const aliceWeb = await makeSubject(alice, 'Web Systems');
        const bobWeb = await makeSubject(bob, 'Web Systems');

        const added = await ann.post(`${base(timetable)}/entries`).send(webClass({ newSubject: { name: 'Capstone' } }));
        expect(added.status).toBe(201);
        const entryId = added.body.schedule.entries[0]._id;
        await alice.put(`${base(timetable)}/entries/${entryId}`).send(webClass({ subject: aliceWeb._id, location: 'Lab 2' }));

        expect((await stored(timetable)).entries[0]).toMatchObject({ subject: null, location: 'Lab 2' });
        expect(await subjectModel.countDocuments({ name: 'Capstone' })).toBe(0);
        expect((await bob.get(base(timetable))).body.schedule.entries[0].subject).toBe(bobWeb._id);
        expect((await alice.get(base(timetable))).body.schedule.entries[0].subject).toBe(aliceWeb._id);
    });
});

describe('who is on it follows the group', () => {
    test('a removed member loses access at once', async () => {
        const { alice, bob, group, timetable } = await setupWithTimetable();
        await alice.delete(`/api/groups/${group._id}/members/${bob.id}`);
        expect((await bob.get(base(timetable))).status).toBe(403);
        expect((await bob.get(`${base(timetable)}/stamp`)).status).toBe(403);
        expect(await collaboratorOf(timetable, bob)).toBeUndefined();
    });

    test('a member who leaves loses access at once', async () => {
        const { bob, group, timetable } = await setupWithTimetable();
        expect((await bob.post('/api/groups/leave').send({ groupId: group._id })).body.success).toBe(true);
        expect((await bob.get(base(timetable))).status).toBe(403);
        expect(await collaboratorOf(timetable, bob)).toBeUndefined();
    });

    test('a removed admin loses editing at once', async () => {
        const { alice, ann, group, timetable } = await setupWithTimetable();
        await alice.delete(`/api/groups/${group._id}/members/${ann.id}`);
        expect((await ann.post(`${base(timetable)}/entries`).send(webClass())).status).toBe(403);
    });

    test('someone joining becomes a viewer', async () => {
        const { group, timetable } = await setupWithTimetable();
        const dave = await signUp('dave@student.fatima.edu.ph', 'Dave');
        await dave.post('/api/groups/join').send({ joinCode: group.joinCode });
        expect(await roleOn(dave, timetable)).toBe('viewer');
        expect((await plan(dave, group)).body.timetable.role).toBe('viewer');
    });

    test('promoting a member makes them an editor, demoting makes them a viewer again', async () => {
        const { alice, bob, group, timetable } = await setupWithTimetable();
        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });
        expect(await roleOn(bob, timetable)).toBe('editor');
        expect((await bob.post(`${base(timetable)}/entries`).send(webClass())).status).toBe(201);

        await alice.delete(`/api/groups/${group._id}/admins/${bob.id}`);
        expect(await roleOn(bob, timetable)).toBe('viewer');
        expect((await bob.post(`${base(timetable)}/entries`).send(webClass({ days: [2] }))).status).toBe(403);
    });

    test('a member\'s "Count in my week" survives every sync', async () => {
        const { alice, bob, group, timetable } = await setupWithTimetable();
        expect((await bob.put(`${base(timetable)}/membership`).send({ countInWorkload: true })).status).toBe(200);

        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });
        expect(await collaboratorOf(timetable, bob)).toMatchObject({ role: 'editor', countInWorkload: true });
        const dave = await signUp('dave@student.fatima.edu.ph', 'Dave');
        await dave.post('/api/groups/join').send({ joinCode: group.joinCode });
        await alice.delete(`/api/groups/${group._id}/admins/${bob.id}`);
        expect(await collaboratorOf(timetable, bob)).toMatchObject({ role: 'viewer', countInWorkload: true });
        expect(await collaboratorOf(timetable, dave)).toMatchObject({ role: 'viewer', countInWorkload: false });
    });

    test('loading the plan puts a timetable that drifted back in step, and writes nothing when it matches', async () => {
        const { ann, bob, carol, group, timetable } = await setupWithTimetable();
        const { updatedAt, __v } = await stored(timetable);
        await plan(bob, group);
        expect(await stored(timetable)).toMatchObject({ updatedAt, __v });

        await scheduleModel.updateOne({ _id: timetable._id }, {
            $set: { collaborators: [{ user: carol.id, role: 'editor' }, { user: bob.id, role: 'editor', countInWorkload: true }] },
        });
        expect(await roleOn(carol, timetable)).toBe('editor');

        await plan(bob, group);
        expect(await roleOn(carol, timetable)).toBeUndefined();
        expect(await collaboratorOf(timetable, bob)).toMatchObject({ role: 'viewer', countInWorkload: true });
        expect(await collaboratorOf(timetable, ann)).toMatchObject({ role: 'editor', countInWorkload: false });
    });

    test('deleting the group deletes its timetable; only the owner can', async () => {
        const { alice, ann, group, timetable } = await setupWithTimetable();
        expect((await ann.delete(`/api/groups/${group._id}`)).body.success).toBe(false);
        expect(await stored(timetable)).not.toBeNull();

        expect((await alice.delete(`/api/groups/${group._id}`)).body.success).toBe(true);
        expect(await stored(timetable)).toBeNull();
    });

    test('a timetable whose group is gone is removed by the next sync', async () => {
        const { group, timetable } = await setupWithTimetable();
        await groupModel.deleteOne({ _id: group._id });
        await syncGroupTimetable(group._id);
        expect(await stored(timetable)).toBeNull();
    });

    test('joins and removals at the same moment leave exactly the members on it', async () => {
        const { alice, group, timetable } = await setupWithTimetable();
        const others = [];
        for (let i = 0; i < 3; i += 1) {
            const member = await signUp(`member${i}@student.fatima.edu.ph`, `Member ${i}`);
            await member.post('/api/groups/join').send({ joinCode: group.joinCode });
            others.push(member);
        }

        for (let round = 0; round < 5; round += 1) {
            const joiner = await signUp(`joiner${round}@student.fatima.edu.ph`, `Joiner ${round}`);
            const leaver = others.shift();
            await Promise.all([
                joiner.post('/api/groups/join').send({ joinCode: group.joinCode }),
                alice.delete(`/api/groups/${group._id}/members/${leaver.id}`),
            ]);
            others.push(joiner);

            const members = (await groupModel.findById(group._id).lean()).members.map(String).filter((id) => id !== alice.id);
            const onTimetable = (await stored(timetable)).collaborators.map((c) => String(c.user));
            expect(onTimetable.sort()).toEqual(members.sort());
        }
    });

    test('a failed sync does not fail the membership change, and the next plan load heals it', async () => {
        const { group, timetable } = await setupWithTimetable();
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(scheduleModel, 'updateOne').mockRejectedValueOnce(new Error('db down'));
        const dave = await signUp('dave@student.fatima.edu.ph', 'Dave');

        const joined = await dave.post('/api/groups/join').send({ joinCode: group.joinCode });
        expect(joined.status).toBe(200);
        expect(joined.body.success).toBe(true);
        expect(logged).toHaveBeenCalledWith('syncGroupTimetable error', expect.any(Error));
        expect(await roleOn(dave, timetable)).toBeUndefined();

        vi.spyOn(scheduleModel, 'updateOne').mockRejectedValueOnce(new Error('db down'));
        expect((await plan(dave, group)).status).toBe(200);
        expect((await plan(dave, group)).body.timetable.role).toBe('viewer');
    });
});

describe('the group decides who is on it, not the timetable', () => {
    const LOCKED = "This timetable belongs to a group. Manage who's on it from the group.";

    test('sharing, the share code, removing someone, making it private and setting it as main all answer 409', async () => {
        const { alice, ann, bob, carol, timetable } = await setupWithTimetable();
        const refused = [
            await alice.post(`${base(timetable)}/share`).send({ userId: carol.id, role: 'viewer' }),
            await alice.put(`${base(timetable)}/share-code`).send({ enabled: true }),
            await alice.delete(`${base(timetable)}/share/${bob.id}`),
            await bob.delete(`${base(timetable)}/share/${bob.id}`),
            await ann.delete(`${base(timetable)}/share/${bob.id}`),
            await alice.post(`${base(timetable)}/make-private`),
            await alice.put(base(timetable)).send({ isMain: true }),
        ];
        refused.forEach((res) => {
            expect(res.status).toBe(409);
            expect(res.body.message).toBe(LOCKED);
        });

        const after = await stored(timetable);
        expect(after.collaborators).toHaveLength(2);
        expect(after.shareCode).toBeUndefined();
        expect(after.isMain).toBe(false);
    });

    test('joining by code is refused, even with a code set behind its back', async () => {
        const { ann, carol, timetable } = await setupWithTimetable();
        await ann.post(`${base(timetable)}/entries`).send(webClass());
        await scheduleModel.updateOne({ _id: timetable._id }, { $set: { shareCode: 'GRPCODE' } });
        const res = await carol.post('/api/schedules/join').send({ shareCode: 'GRPCODE' });
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(LOCKED);
        expect(await roleOn(carol, timetable)).toBeUndefined();

        expect((await carol.post('/api/schedules/preview').send({ shareCode: 'GRPCODE' })).status).toBe(404);
        const entryId = (await stored(timetable)).entries[0]?._id;
        const imported = await carol.post('/api/schedules/import').send({ shareCode: 'GRPCODE', selections: [{ id: entryId }] });
        expect(imported.status).toBe(404);
        expect(await scheduleModel.countDocuments({ owner: carol.id })).toBe(0);
    });

    test('the schedule view tells even the owner that sharing is off', async () => {
        const { alice, timetable } = await setupWithTimetable();
        expect((await alice.get(base(timetable))).body.schedule.canShare).toBe(false);
    });

    test('a member can still make their own copy', async () => {
        const { ann, bob, timetable } = await setupWithTimetable();
        await ann.post(`${base(timetable)}/entries`).send(webClass());
        const bobWeb = await makeSubject(bob, 'Web Systems');

        const copy = await bob.post(`${base(timetable)}/duplicate`);
        expect(copy.status).toBe(201);
        expect(copy.body.schedule).toMatchObject({ role: 'owner', isMain: true, group: null });
        const saved = await scheduleModel.findById(copy.body.schedule._id).lean();
        expect(String(saved.owner)).toBe(bob.id);
        expect(saved.group).toBeNull();
        expect(String(saved.entries[0].subject)).toBe(bobWeb._id);
    });

    test('imports and chat shares never treat it as the owner\'s own', async () => {
        const { alice, ann, group, timetable } = await setupWithTimetable();
        await ann.post(`${base(timetable)}/entries`).send(webClass());
        const friend = await signUp('fay@student.fatima.edu.ph', 'Fay');
        const { schedule } = (await friend.post('/api/schedules').send({ title: 'Fay week' })).body;
        await friend.post(`/api/schedules/${schedule._id}/entries`).send(webClass({ title: 'PE' }));
        await friend.put(`/api/schedules/${schedule._id}/share-code`).send({ enabled: true });
        const { shareCode } = (await friend.get(`/api/schedules/${schedule._id}`)).body.schedule;
        const entryId = (await stored(schedule)).entries[0]._id;

        const preview = await alice.post('/api/schedules/preview').send({ shareCode });
        expect(preview.body.schedules.map((s) => s._id)).not.toContain(timetable._id);

        const intoGroup = await alice.post('/api/schedules/import').send({ shareCode, selections: [{ id: entryId }], targetScheduleId: timetable._id });
        expect(intoGroup.status).toBe(404);

        const byDefault = await alice.post('/api/schedules/import').send({ shareCode, selections: [{ id: entryId }] });
        expect(byDefault.status).toBe(201);
        expect(byDefault.body.schedule._id).not.toBe(timetable._id);
        expect(byDefault.body.schedule.isMain).toBe(true);
        expect((await stored(timetable)).entries.map((e) => e.title)).toEqual(['Web Systems']);

        const posted = await alice.post(`/api/groups/${group._id}/messages`).send({ scheduleId: timetable._id });
        expect(posted.status).toBe(404);
    });
});

describe('the owner\'s subjects never reach the group timetable', () => {
    test('deleting the owner\'s "Web Systems" leaves the group\'s "Web Systems" class', async () => {
        const { alice, ann, timetable } = await setupWithTimetable();
        await ann.post(`${base(timetable)}/entries`).send(webClass());
        const web = await makeSubject(alice, 'Web Systems');
        await alice.post('/api/schedules/main/entries').send(webClass({ subject: web._id, days: [3] }));

        const deleted = await alice.delete(`/api/subjects/${web._id}`);
        expect(deleted.body).toMatchObject({ success: true, removedClassTimes: 1 });
        expect((await stored(timetable)).entries.map((e) => e.title)).toEqual(['Web Systems']);
    });

    test('making, renaming and deleting a subject skip the group timetable, even a class linked by mistake', async () => {
        const { alice, ann, timetable } = await setupWithTimetable();
        await ann.post(`${base(timetable)}/entries`).send(webClass());

        // The group's classes aren't the owner's to turn into subjects.
        expect((await alice.get('/api/subjects/suggestions')).body.suggestions).toEqual([]);
        // Creating the subject links the owner's unlinked classes by name: not the group's.
        const web = await makeSubject(alice, 'Web Systems');
        expect((await stored(timetable)).entries[0].subject).toBeNull();

        // A link stored by an older build must not let the owner's subject edits reach the group's class.
        await scheduleModel.updateOne({ _id: timetable._id }, { $set: { 'entries.0.subject': web._id } });
        await alice.patch(`/api/subjects/${web._id}`).send({ name: 'Web Dev' });
        expect((await stored(timetable)).entries[0].title).toBe('Web Systems');

        await alice.delete(`/api/subjects/${web._id}`);
        expect((await stored(timetable)).entries.map((e) => e.title)).toEqual(['Web Systems']);
    });

    test('a subject\'s class count leaves out the group timetable', async () => {
        const { alice, ann, timetable } = await setupWithTimetable();
        await ann.post(`${base(timetable)}/entries`).send(webClass());
        const web = await makeSubject(alice, 'Web Systems');
        await alice.post('/api/schedules/main/entries').send(webClass({ subject: web._id, days: [3] }));
        await scheduleModel.updateOne({ _id: timetable._id }, { $set: { 'entries.0.subject': web._id } });

        const listed = (await alice.get('/api/subjects')).body.subjects.find((s) => s._id === web._id);
        expect(listed.counts.classTimes).toBe(1);
    });
});
