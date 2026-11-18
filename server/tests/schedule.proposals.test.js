import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import scheduleModel from '../models/scheduleModel.js';
import classChoiceModel from '../models/classChoiceModel.js';
import classProposalModel from '../models/classProposalModel.js';
import notificationModel from '../models/notificationModel.js';
import Friend from '../models/Friend.js';
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
];
const classBody = (overrides = {}) => ({ kind: 'class', startTime: '08:00', endTime: '10:00', ...overrides });

const base = (timetable) => `/api/schedules/${timetable._id}`;
const onClass = (timetable, entryId) => `${base(timetable)}/mine/classes/${entryId}`;
const onProposal = (timetable, proposalId, verb) => `${base(timetable)}/proposals/${proposalId}/${verb}`;

// Alice owns BSIT 3-1 and its timetable (three classes), Ann is an admin, Bob and Cy are members, Carol is an
// outsider. `ids` maps class titles to the group timetable's entry ids.
const setup = async () => {
    const [alice, ann, bob, cy, carol] = await Promise.all([
        ['alice', 'Alice'], ['ann', 'Ann'], ['bob', 'Bob'], ['cy', 'Cy'], ['carol', 'Carol'],
    ].map(([handle, name]) => signUp(`${handle}@student.fatima.edu.ph`, name)));
    const { group } = (await alice.post('/api/groups').send({ name: 'BSIT 3-1' })).body;
    for (const member of [ann, bob, cy]) await member.post('/api/groups/join').send({ joinCode: group.joinCode });
    await alice.post(`/api/groups/${group._id}/admins`).send({ userId: ann.id });
    const timetable = (await alice.post(`/api/groups/${group._id}/timetable`)).body.timetable;
    for (const c of CLASSES) await alice.post(`${base(timetable)}/entries`).send(classBody(c));
    const { entries } = await scheduleModel.findById(timetable._id).lean();
    const ids = Object.fromEntries(entries.map((e) => [e.title, String(e._id)]));
    return { alice, ann, bob, cy, carol, group, timetable, ids };
};

const weekOf = async (agent) => {
    const res = await agent.get(`/api/schedules/week?start=${MONDAY}`);
    expect(res.status).toBe(200);
    return res.body.days.flatMap((day) => day.entries);
};
const timesOf = async (agent, title) => (await weekOf(agent)).filter((e) => e.title === title).map((e) => e.startTime);

const sharedEntry = async (timetable, entryId) => (await scheduleModel.findById(timetable._id).lean())
    .entries.find((e) => String(e._id) === entryId);
const mainOf = (agent) => scheduleModel.findOne({ owner: agent.id, isMain: true }).lean();
const choiceDoc = (agent, timetable) => classChoiceModel.findOne({ user: agent.id, schedule: timetable._id }).lean();
const linesOf = (agent) => notificationModel.find({ recipient: agent.id, type: 'schedule_proposal' }).lean();
const messagesOf = async (agent) => (await linesOf(agent)).map((n) => n.message);
const countIt = (agent, timetable) => agent.put(`${base(timetable)}/membership`).send({ countInWorkload: true });

// The member customizes the class and moves their own copy to `startTime`, ready to propose it.
const customizeAt = async (agent, timetable, ids, title, startTime = '09:00') => {
    const res = await agent.post(`${onClass(timetable, ids[title])}/customize`);
    expect(res.status).toBe(201);
    const [hours] = startTime.split(':');
    const moved = await agent.put(`/api/schedules/${res.body.scheduleId}/entries/${res.body.entryId}`)
        .send(classBody({ title, days: [CLASSES.find((c) => c.title === title).days[0]], startTime, endTime: `${Number(hours) + 2}:00` }));
    expect(moved.status).toBe(200);
    return res.body;
};

const propose = (agent, timetable, ids, title) => agent.post(`${onClass(timetable, ids[title])}/propose`);

describe('proposing a time', () => {
    test('Cy proposes: Alice and Ann get an inbox line, Bob and Cy do not', async () => {
        const { alice, ann, bob, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        await notificationModel.deleteMany({});

        const res = await propose(cy, timetable, ids, 'Web Systems');
        expect(res.status).toBe(201);
        expect(res.body.proposal).toMatchObject({
            title: 'Web Systems', status: 'open', stale: false, fields: { startTime: '09:00', endTime: '11:00' },
        });
        expect(await messagesOf(alice)).toEqual(['Cy proposed a new time for "Web Systems".']);
        expect(await messagesOf(ann)).toEqual(['Cy proposed a new time for "Web Systems".']);
        expect(await linesOf(bob)).toEqual([]);
        expect(await linesOf(cy)).toEqual([]);
        expect((await linesOf(alice))[0].link).toBe(`/plan?timetable=${timetable._id}`);
        expect((await sharedEntry(timetable, ids['Web Systems'])).startTime).toBe('08:00');
    });

    test('a second open proposal from Cy on the same class is a 409; another class is fine', async () => {
        const { cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        await customizeAt(cy, timetable, ids, 'Networking', '10:00');
        expect((await propose(cy, timetable, ids, 'Web Systems')).status).toBe(201);
        const again = await propose(cy, timetable, ids, 'Web Systems');
        expect(again.status).toBe(409);
        expect(again.body.message).toBe('You already proposed a time for this class.');
        expect((await propose(cy, timetable, ids, 'Networking')).status).toBe(201);
        expect(await classProposalModel.countDocuments({ proposer: cy.id, status: 'open' })).toBe(2);
    });

    test('refusals: not customized, same time as the class, class moved since, an editor, bad ids', async () => {
        const { alice, ann, bob, cy, timetable, ids } = await setup();
        expect((await propose(bob, timetable, ids, 'Web Systems')).status).toBe(400);

        const copy = await customizeAt(cy, timetable, ids, 'Web Systems', '08:00');
        const same = await propose(cy, timetable, ids, 'Web Systems');
        expect(same.status).toBe(400);
        expect(same.body.message).toBe('Your time is the same as the class already has.');

        await cy.put(`/api/schedules/${copy.scheduleId}/entries/${copy.entryId}`)
            .send(classBody({ title: 'Web Systems', days: [1], startTime: '09:00', endTime: '11:00' }));
        await alice.put(`${base(timetable)}/entries/${ids['Web Systems']}`)
            .send(classBody({ title: 'Web Systems', days: [1], startTime: '07:00', endTime: '09:00' }));
        const moved = await propose(cy, timetable, ids, 'Web Systems');
        expect(moved.status).toBe(409);
        expect(moved.body.message).toBe('This class changed since you customized it.');

        const asEditor = await propose(ann, timetable, ids, 'Networking');
        expect(asEditor.status).toBe(400);
        expect(asEditor.body.message).toBe('You can change this class for everyone yourself.');

        expect((await cy.post(`${base(timetable)}/mine/classes/not-an-id/propose`)).status).toBe(404);
        expect((await cy.post(`${base(timetable)}/mine/classes/${timetable._id}/propose`)).status).toBe(404);
        expect(await classProposalModel.countDocuments({})).toBe(0);
    });
});

describe('approving', () => {
    test("Ann approves: everyone following sees 9:00, Cy's copy and choice are gone, Cy hears it was approved", async () => {
        const { alice, ann, bob, cy, timetable, ids } = await setup();
        await Promise.all([countIt(bob, timetable), countIt(cy, timetable)]);
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        await notificationModel.deleteMany({});

        const res = await ann.post(onProposal(timetable, proposal._id, 'approve'));
        expect(res.status).toBe(200);
        expect(await timesOf(bob, 'Web Systems')).toEqual(['09:00']);
        // Cy follows the class again: one entry in his week, the group's.
        expect(await timesOf(cy, 'Web Systems')).toEqual(['09:00']);
        expect((await mainOf(cy)).entries.some((e) => e.title === 'Web Systems')).toBe(false);
        expect((await choiceDoc(cy, timetable)).choices).toEqual([]);

        expect(await messagesOf(cy)).toEqual(['Ann approved your change to "Web Systems".']);
        const changes = await notificationModel.find({ recipient: cy.id, type: 'schedule_change' });
        expect(changes).toEqual([]);
        const closed = await classProposalModel.findById(proposal._id).lean();
        expect(closed).toMatchObject({ status: 'approved' });
        expect(String(closed.decidedBy)).toBe(ann.id);
        expect(closed.decidedAt).toBeTruthy();
    });

    test('everyone else on the timetable gets the usual change line, the owner too', async () => {
        const { alice, ann, bob, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        await notificationModel.deleteMany({});
        await ann.post(onProposal(timetable, proposal._id, 'approve'));
        const changeLines = async (agent) => (await notificationModel.find({ recipient: agent.id, type: 'schedule_change' })).map((n) => n.message);
        expect(await changeLines(bob)).toEqual(['Ann edited "Web Systems"']);
        expect(await changeLines(alice)).toEqual(['Ann edited "Web Systems"']);
        expect(await changeLines(ann)).toEqual([]);
    });

    test('the class moved before approval: approve is a 409, nothing changes, and the editor can decline', async () => {
        const { alice, ann, cy, timetable, ids } = await setup();
        const copy = await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        await alice.put(`${base(timetable)}/entries/${ids['Web Systems']}`)
            .send(classBody({ title: 'Web Systems', days: [1], startTime: '10:00', endTime: '12:00' }));

        const list = await ann.get(`${base(timetable)}/proposals`);
        expect(list.body.proposals).toHaveLength(1);
        expect(list.body.proposals[0].stale).toBe(true);

        const res = await ann.post(onProposal(timetable, proposal._id, 'approve'));
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('This class changed since it was proposed.');
        expect((await sharedEntry(timetable, ids['Web Systems'])).startTime).toBe('10:00');
        expect((await classProposalModel.findById(proposal._id)).status).toBe('open');
        expect((await mainOf(cy)).entries.some((e) => String(e._id) === copy.entryId)).toBe(true);

        expect((await ann.post(onProposal(timetable, proposal._id, 'decline'))).status).toBe(200);
    });

    test('approving twice is a 409 the second time', async () => {
        const { alice, ann, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        expect((await ann.post(onProposal(timetable, proposal._id, 'approve'))).status).toBe(200);
        expect((await alice.post(onProposal(timetable, proposal._id, 'approve'))).status).toBe(409);
    });

    test('two editors approving at the same moment: one applies it', async () => {
        const { alice, ann, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        const answers = await Promise.all([alice, ann].map((agent) => agent.post(onProposal(timetable, proposal._id, 'approve'))));
        expect(answers.map((r) => r.status).sort()).toEqual([200, 409]);
        expect((await sharedEntry(timetable, ids['Web Systems'])).startTime).toBe('09:00');
    });
});

describe('declining and withdrawing', () => {
    test('Ann declines: Cy keeps his copy and choice, hears it was declined, and may propose again', async () => {
        const { ann, cy, timetable, ids } = await setup();
        const copy = await customizeAt(cy, timetable, ids, 'Networking', '10:00');
        const { proposal } = (await propose(cy, timetable, ids, 'Networking')).body;
        await notificationModel.deleteMany({});

        expect((await ann.post(onProposal(timetable, proposal._id, 'decline'))).status).toBe(200);
        expect(await messagesOf(cy)).toEqual(['Ann declined your change to "Networking".']);
        expect((await mainOf(cy)).entries.some((e) => String(e._id) === copy.entryId)).toBe(true);
        expect((await choiceDoc(cy, timetable)).choices).toHaveLength(1);
        expect((await sharedEntry(timetable, ids.Networking)).startTime).toBe('08:00');
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'declined' });

        expect((await propose(cy, timetable, ids, 'Networking')).status).toBe(201);
    });

    test('Cy withdraws his own proposal and nobody is told', async () => {
        const { alice, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        await notificationModel.deleteMany({});

        expect((await cy.post(onProposal(timetable, proposal._id, 'withdraw'))).status).toBe(200);
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'withdrawn' });
        expect(await notificationModel.countDocuments({})).toBe(0);
        expect((await alice.post(onProposal(timetable, proposal._id, 'approve'))).status).toBe(409);
        expect((await cy.post(onProposal(timetable, proposal._id, 'withdraw'))).status).toBe(409);
        expect((await propose(cy, timetable, ids, 'Web Systems')).status).toBe(201);
    });
});

describe('closing proposals', () => {
    test('deleting the class closes its proposals; the others stay open', async () => {
        const { alice, ann, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        await customizeAt(cy, timetable, ids, 'Networking', '10:00');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        await propose(cy, timetable, ids, 'Networking');

        expect((await alice.delete(`${base(timetable)}/entries/${ids['Web Systems']}`)).status).toBe(200);
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'withdrawn' });
        expect((await ann.post(onProposal(timetable, proposal._id, 'approve'))).status).toBe(409);
        const open = (await ann.get(`${base(timetable)}/proposals`)).body.proposals;
        expect(open.map((p) => p.title)).toEqual(['Networking']);
    });

    test('Cy leaving the group closes his open proposals', async () => {
        const { ann, cy, group, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        await cy.post('/api/groups/leave').send({ groupId: group._id });
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'withdrawn' });
        expect((await ann.post(onProposal(timetable, proposal._id, 'approve'))).status).toBe(409);
    });

    test('Ann removing Cy from the group closes his open proposals', async () => {
        const { ann, cy, group, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        expect((await ann.delete(`/api/groups/${group._id}/members/${cy.id}`)).status).toBe(200);
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'withdrawn' });
    });

    test('deleting the group deletes its proposals', async () => {
        const { alice, cy, group, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        await propose(cy, timetable, ids, 'Web Systems');
        expect((await alice.delete(`/api/groups/${group._id}`)).status).toBe(200);
        expect(await classProposalModel.countDocuments({})).toBe(0);
    });
});

describe('who can do what', () => {
    test('Bob (a member) can neither approve nor decline, and cannot withdraw or see Cy\'s proposal', async () => {
        const { bob, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;

        expect((await bob.post(onProposal(timetable, proposal._id, 'approve'))).status).toBe(403);
        expect((await bob.post(onProposal(timetable, proposal._id, 'decline'))).status).toBe(403);
        expect((await bob.post(onProposal(timetable, proposal._id, 'withdraw'))).status).toBe(404);
        expect((await bob.get(`${base(timetable)}/proposals`)).body.proposals).toEqual([]);
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'open' });
        expect((await sharedEntry(timetable, ids['Web Systems'])).startTime).toBe('08:00');
    });

    test('the proposer sees only his own proposals, editors see all, with the name', async () => {
        const { ann, bob, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        await customizeAt(bob, timetable, ids, 'Networking', '10:00');
        await propose(cy, timetable, ids, 'Web Systems');
        await propose(bob, timetable, ids, 'Networking');

        const seen = async (agent) => (await agent.get(`${base(timetable)}/proposals`)).body.proposals;
        expect((await seen(ann)).map((p) => [p.title, p.proposer.name])).toEqual([['Web Systems', 'Cy'], ['Networking', 'Bob']]);
        expect((await seen(cy)).map((p) => p.title)).toEqual(['Web Systems']);
        expect((await seen(bob)).map((p) => p.title)).toEqual(['Networking']);
    });

    test('Carol, who is not on the timetable, gets 404 on every proposal route', async () => {
        const { carol, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        const answers = await Promise.all([
            carol.get(`${base(timetable)}/proposals`),
            propose(carol, timetable, ids, 'Web Systems'),
            carol.post(onProposal(timetable, proposal._id, 'approve')),
            carol.post(onProposal(timetable, proposal._id, 'decline')),
            carol.post(onProposal(timetable, proposal._id, 'withdraw')),
        ]);
        expect(answers.map((r) => r.status)).toEqual([404, 404, 404, 404, 404]);
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'open' });
    });

    test("a proposal id from another timetable, or a bad one, is a 404 and changes nothing", async () => {
        const { alice, ann, cy, timetable, ids } = await setup();
        await customizeAt(cy, timetable, ids, 'Web Systems');
        const { proposal } = (await propose(cy, timetable, ids, 'Web Systems')).body;
        const other = (await alice.post('/api/schedules').send({ title: 'Mine' })).body.schedule;

        expect((await alice.post(onProposal(other, proposal._id, 'approve'))).status).toBe(404);
        expect((await alice.post(onProposal(other, proposal._id, 'decline'))).status).toBe(404);
        expect((await ann.post(onProposal(timetable, 'nope', 'approve'))).status).toBe(404);
        expect((await ann.post(onProposal(timetable, ann.id, 'approve'))).status).toBe(404);
        expect((await ann.get('/api/schedules/nope/proposals')).status).toBe(404);
        expect(await classProposalModel.findById(proposal._id)).toMatchObject({ status: 'open' });
    });
});

describe('a timetable a friend shared', () => {
    test("Fay (a viewer) proposes and Alice, who owns it, approves; Fay's copy goes and she hears it", async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const fay = await signUp('fay@student.fatima.edu.ph', 'Fay');
        await Friend.create({ user: alice.id, friend: fay.id, status: 'accepted' });
        const own = (await alice.post('/api/schedules').send({ title: 'My classes' })).body.schedule;
        await alice.post(`${base(own)}/entries`).send(classBody(CLASSES[0]));
        await alice.post(`${base(own)}/share`).send({ userId: fay.id, role: 'viewer' });
        const entryId = String((await scheduleModel.findById(own._id).lean()).entries[0]._id);
        const ids = { 'Web Systems': entryId };

        const copy = await customizeAt(fay, own, ids, 'Web Systems');
        const { proposal } = (await propose(fay, own, ids, 'Web Systems')).body;
        expect(await messagesOf(alice)).toEqual(['Fay proposed a new time for "Web Systems".']);
        expect((await fay.post(onProposal(own, proposal._id, 'approve'))).status).toBe(403);

        expect((await alice.post(onProposal(own, proposal._id, 'approve'))).status).toBe(200);
        expect((await sharedEntry(own, entryId)).startTime).toBe('09:00');
        expect((await mainOf(fay)).entries.some((e) => String(e._id) === copy.entryId)).toBe(false);
        expect(await messagesOf(fay)).toEqual(['Alice approved your change to "Web Systems".']);
    });
});
