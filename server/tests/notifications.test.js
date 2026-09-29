import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import taskModel from '../models/taskModel.js';
import notificationModel from '../models/notificationModel.js';
import pushSubscriptionModel from '../models/pushSubscriptionModel.js';
import { runTaskReminders } from '../utils/reminders.js';
import { sendPushToUser } from '../utils/push.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

// Real pushes need VAPID keys and a live browser, so the push layer is a stub here.
vi.mock('../utils/push.js', () => ({
    sendPushToUser: vi.fn().mockResolvedValue(undefined),
    getPublicKey: vi.fn(() => 'test-public-key'),
    isPushConfigured: vi.fn(() => true),
}));

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
});
afterAll(closeTestDB);

const signUp = async (name) => {
    const email = `${name.toLowerCase()}@student.fatima.edu.ph`;
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const user = await userModel.findOne({ email });
    return { agent, id: user._id.toString(), user };
};

const inbox = async (person) => (await person.agent.get('/api/notifications')).body;

// alice owns "Study Squad", bob joined it. Joining creates a notification for alice, so
// the tables are cleared to give each test a clean inbox.
const groupSetup = async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    const { group } = (await alice.agent.post('/api/groups').send({ name: 'Study Squad' })).body;
    await bob.agent.post('/api/groups/join').send({ joinCode: group.joinCode });
    await notificationModel.deleteMany({});
    vi.clearAllMocks();
    return { alice, bob, group };
};

describe('inbox', () => {
    test('lists only the caller\'s notifications, with an unread count', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');
        await notificationModel.create({ recipient: alice.id, type: 'system', message: 'For Alice' });
        await notificationModel.create({ recipient: bob.id, type: 'system', message: 'For Bob' });

        const body = await inbox(alice);
        expect(body.notifications).toHaveLength(1);
        expect(body.notifications[0].message).toBe('For Alice');
        expect(body.unreadCount).toBe(1);
    });

    test('mark one, mark all, delete and clear work, and can\'t touch someone else\'s', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');
        const [a1, a2] = await notificationModel.create([
            { recipient: alice.id, type: 'system', message: 'one' },
            { recipient: alice.id, type: 'system', message: 'two' },
        ]);
        const b1 = await notificationModel.create({ recipient: bob.id, type: 'system', message: 'bob' });

        expect((await bob.agent.put(`/api/notifications/${a1._id}/read`)).body.success).toBe(false);
        expect((await bob.agent.delete(`/api/notifications/${a1._id}`)).body.success).toBe(false);

        await alice.agent.put(`/api/notifications/${a1._id}/read`);
        expect((await inbox(alice)).unreadCount).toBe(1);

        await alice.agent.put('/api/notifications/read-all');
        expect((await inbox(alice)).unreadCount).toBe(0);

        await alice.agent.delete(`/api/notifications/${a2._id}`);
        expect((await inbox(alice)).notifications).toHaveLength(1);

        await alice.agent.delete('/api/notifications/clear-all');
        expect((await inbox(alice)).notifications).toHaveLength(0);
        expect(await notificationModel.countDocuments({ _id: b1._id })).toBe(1);
    });

    test('needs a login', async () => {
        const res = await request(app).get('/api/notifications');
        expect(res.body.success).toBe(false);
    });
});

describe('friends', () => {
    test('a friend request notifies the receiver, accepting notifies the sender', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');

        await alice.agent.post('/api/friends/request').send({ profileTag: bob.user.profileTag });
        const bobInbox = await inbox(bob);
        expect(bobInbox.notifications[0].type).toBe('friend_request');
        expect(bobInbox.notifications[0].message).toContain('Alice');
        expect(sendPushToUser).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ url: '/friends' }));

        const pending = (await bob.agent.get('/api/friends/pending')).body.requests;
        await bob.agent.put(`/api/friends/accept/${pending[0]._id}`);

        const aliceInbox = await inbox(alice);
        expect(aliceInbox.notifications[0].type).toBe('friend_accepted');
        expect(aliceInbox.notifications[0].message).toContain('Bob');
    });

    test('turning friend alerts off silences both', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');
        await bob.agent.put('/api/notifications/preferences').send({ friendActivity: false });

        await alice.agent.post('/api/friends/request').send({ profileTag: bob.user.profileTag });
        expect((await inbox(bob)).notifications).toHaveLength(0);
        expect(sendPushToUser).not.toHaveBeenCalled();
    });
});

describe('group notifications', () => {
    test('a chat message notifies the other members and not the sender', async () => {
        const { alice, bob, group } = await groupSetup();
        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'Anyone free tonight?' });

        const aliceInbox = await inbox(alice);
        expect(aliceInbox.notifications).toHaveLength(1);
        expect(aliceInbox.notifications[0]).toMatchObject({
            type: 'group_message',
            title: 'Study Squad',
            message: 'Bob: Anyone free tonight?',
            link: `/groups?g=${group._id}`,
        });
        expect((await inbox(bob)).notifications).toHaveLength(0);
        expect(sendPushToUser).toHaveBeenCalledTimes(1);
    });

    test('several unread messages fold into one entry with a count', async () => {
        const { alice, bob, group } = await groupSetup();
        for (const text of ['one', 'two', 'three']) {
            await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text });
        }
        const { notifications } = await inbox(alice);
        expect(notifications).toHaveLength(1);
        expect(notifications[0].count).toBe(3);
        expect(notifications[0].message).toBe('3 new messages');
    });

    test('after it is read, the next message starts a fresh entry', async () => {
        const { alice, bob, group } = await groupSetup();
        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'first' });
        await alice.agent.put('/api/notifications/read-all');
        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'second' });

        const { notifications, unreadCount } = await inbox(alice);
        expect(notifications).toHaveLength(2);
        expect(unreadCount).toBe(1);
    });

    test('a shared task gets its own notification even with chat unread', async () => {
        const { alice, bob, group } = await groupSetup();
        const created = await bob.agent.post('/api/tasks').send({
            title: 'Lab report', course: 'CHEM 101', dueDate: '2030-01-15', hours: 2, difficulty: 3, importance: 4,
        });
        const taskId = created.body.task?._id || (await taskModel.findOne({ owner: bob.id }))._id;

        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'hi' });
        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ taskId });

        const types = (await inbox(alice)).notifications.map((n) => n.type).sort();
        expect(types).toEqual(['group_message', 'group_task']);
    });

    test('someone joining or leaving notifies the right people', async () => {
        const { alice, bob, group } = await groupSetup();
        const carol = await signUp('Carol');

        await carol.agent.post('/api/groups/join').send({ joinCode: group.joinCode });
        expect((await inbox(alice)).notifications[0].message).toBe('Carol joined the group.');
        expect((await inbox(bob)).notifications[0].message).toBe('Carol joined the group.');
        expect((await inbox(carol)).notifications).toHaveLength(0);

        await notificationModel.deleteMany({});
        await carol.agent.post('/api/groups/leave').send({ groupId: group._id });
        expect((await inbox(alice)).notifications[0].message).toBe('Carol left the group.');
        expect((await inbox(bob)).notifications).toHaveLength(0);
    });

    test('muting a group silences everything from it', async () => {
        const { alice, bob, group } = await groupSetup();
        await alice.agent.put('/api/notifications/preferences')
            .send({ groupOverrides: [{ group: group._id, level: 'muted' }] });

        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'hello?' });
        expect((await inbox(alice)).notifications).toHaveLength(0);
        expect(sendPushToUser).not.toHaveBeenCalled();
    });

    test('"tasks only" lets shared tasks through but not chat or joins', async () => {
        const { alice, bob, group } = await groupSetup();
        await alice.agent.put('/api/notifications/preferences')
            .send({ groupOverrides: [{ group: group._id, level: 'tasks' }] });

        await bob.agent.post('/api/tasks').send({
            title: 'Essay', course: 'ENG 1', dueDate: '2030-01-15', hours: 2, difficulty: 3, importance: 3,
        });
        const taskId = (await taskModel.findOne({ owner: bob.id }))._id;

        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'chatter' });
        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ taskId });

        const { notifications } = await inbox(alice);
        expect(notifications.map((n) => n.type)).toEqual(['group_task']);
    });

    test('the global group switches apply to every group', async () => {
        const { alice, bob, group } = await groupSetup();
        await alice.agent.put('/api/notifications/preferences').send({ groupMessages: false });

        await bob.agent.post(`/api/groups/${group._id}/messages`).send({ text: 'ignored' });
        expect((await inbox(alice)).notifications).toHaveLength(0);

        await alice.agent.put('/api/notifications/preferences').send({ groupMessages: true, groupMembers: false });
        const carol = await signUp('Carol');
        await carol.agent.post('/api/groups/join').send({ joinCode: group.joinCode });
        expect((await inbox(alice)).notifications).toHaveLength(0);
    });

    test('deleting a group tells its members', async () => {
        const { alice, bob, group } = await groupSetup();
        await alice.agent.delete(`/api/groups/${group._id}`);

        const { notifications } = await inbox(bob);
        expect(notifications[0].message).toBe('The group was deleted by its admin.');
        expect((await inbox(alice)).notifications).toHaveLength(0);
    });
});

describe('preferences', () => {
    test('default to everything on', async () => {
        const alice = await signUp('Alice');
        const { preferences } = (await alice.agent.get('/api/notifications/preferences')).body;
        expect(preferences).toEqual({
            taskReminders: true, reminderLeadHours: 24, friendActivity: true, scheduleShares: true,
            groupMessages: true, groupTasks: true, groupMembers: true, groupOverrides: [],
        });
    });

    test('save partial updates and keep the rest', async () => {
        const alice = await signUp('Alice');
        await alice.agent.put('/api/notifications/preferences').send({ groupTasks: false, reminderLeadHours: 3 });
        const { preferences } = (await alice.agent.get('/api/notifications/preferences')).body;
        expect(preferences).toMatchObject({ groupTasks: false, reminderLeadHours: 3, groupMessages: true });
    });

    test('reject bad values', async () => {
        const alice = await signUp('Alice');
        expect((await alice.agent.put('/api/notifications/preferences').send({ groupMessages: 'yes' })).body.success).toBe(false);
        expect((await alice.agent.put('/api/notifications/preferences').send({ reminderLeadHours: 5 })).body.success).toBe(false);
        expect((await alice.agent.put('/api/notifications/preferences').send({ groupOverrides: [{ group: 'nope', level: 'muted' }] })).body.success).toBe(false);
    });

    test('setting a group back to "all" removes its override', async () => {
        const { alice, group } = await groupSetup();
        await alice.agent.put('/api/notifications/preferences').send({ groupOverrides: [{ group: group._id, level: 'muted' }] });
        const back = await alice.agent.put('/api/notifications/preferences').send({ groupOverrides: [{ group: group._id, level: 'all' }] });
        expect(back.body.preferences.groupOverrides).toEqual([]);
    });
});

describe('task reminders', () => {
    const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
    const makeTask = (owner, overrides = {}) => taskModel.create({
        title: 'Capstone report', course: 'CS 499', dueDate: hoursFromNow(10), owner, ...overrides,
    });

    test('a task due inside the window gets one reminder, however often the job runs', async () => {
        const alice = await signUp('Alice');
        await makeTask(alice.id);

        await runTaskReminders();
        await runTaskReminders();

        const { notifications } = await inbox(alice);
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('task_reminder');
        expect(notifications[0].message).toContain('Capstone report');
        expect(notifications[0].message).toContain('24 hours');
    });

    test('ignores far-off, finished and already-late tasks', async () => {
        const alice = await signUp('Alice');
        await makeTask(alice.id, { dueDate: hoursFromNow(30) });
        await makeTask(alice.id, { isCompleted: true });
        await makeTask(alice.id, { dueDate: hoursFromNow(-2) });

        await runTaskReminders();
        expect((await inbox(alice)).notifications).toHaveLength(0);
    });

    test('follows each person\'s lead time and on/off switch', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');
        await alice.agent.put('/api/notifications/preferences').send({ reminderLeadHours: 48 });
        await bob.agent.put('/api/notifications/preferences').send({ taskReminders: false });
        await makeTask(alice.id, { dueDate: hoursFromNow(40) });
        await makeTask(bob.id);

        await runTaskReminders();
        expect((await inbox(alice)).notifications).toHaveLength(1);
        expect((await inbox(bob)).notifications).toHaveLength(0);
    });

    test('changing the due date reminds again', async () => {
        const alice = await signUp('Alice');
        const task = await makeTask(alice.id);
        await runTaskReminders();

        task.dueDate = hoursFromNow(12);
        await task.save();
        await runTaskReminders();
        expect((await inbox(alice)).notifications).toHaveLength(2);
    });
});

describe('push subscriptions', () => {
    const subscription = (endpoint = 'https://push.example.com/abc') => ({
        endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    });

    test('key endpoint hands out the public key', async () => {
        const alice = await signUp('Alice');
        const res = await alice.agent.get('/api/notifications/push/key');
        expect(res.body).toMatchObject({ success: true, enabled: true, publicKey: 'test-public-key' });
    });

    test('subscribing stores the device once, even if repeated', async () => {
        const alice = await signUp('Alice');
        await alice.agent.post('/api/notifications/push/subscribe').send({ subscription: subscription() });
        await alice.agent.post('/api/notifications/push/subscribe').send({ subscription: subscription() });
        expect(await pushSubscriptionModel.countDocuments({ user: alice.id })).toBe(1);
    });

    test('a device that switches accounts belongs to the new one', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');
        await alice.agent.post('/api/notifications/push/subscribe').send({ subscription: subscription() });
        await bob.agent.post('/api/notifications/push/subscribe').send({ subscription: subscription() });

        expect(await pushSubscriptionModel.countDocuments({ user: alice.id })).toBe(0);
        expect(await pushSubscriptionModel.countDocuments({ user: bob.id })).toBe(1);
    });

    test('rejects malformed or non-https subscriptions', async () => {
        const alice = await signUp('Alice');
        const bad = [
            {},
            { endpoint: 'http://insecure.example.com', keys: { p256dh: 'a', auth: 'b' } },
            { endpoint: 'https://push.example.com/x' },
        ];
        for (const sub of bad) {
            expect((await alice.agent.post('/api/notifications/push/subscribe').send({ subscription: sub })).body.success).toBe(false);
        }
    });

    test('unsubscribing removes only your own device', async () => {
        const alice = await signUp('Alice');
        const bob = await signUp('Bob');
        await alice.agent.post('/api/notifications/push/subscribe').send({ subscription: subscription() });

        await bob.agent.post('/api/notifications/push/unsubscribe').send({ endpoint: subscription().endpoint });
        expect(await pushSubscriptionModel.countDocuments()).toBe(1);

        await alice.agent.post('/api/notifications/push/unsubscribe').send({ endpoint: subscription().endpoint });
        expect(await pushSubscriptionModel.countDocuments()).toBe(0);
    });
});
