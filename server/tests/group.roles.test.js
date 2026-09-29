import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';
import { containsProfanity } from '../utils/familyFilter.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

// A valid 1x1 JPEG-shaped data URL. The server only checks the shape and size.
const PICTURE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const signUp = async (email, name) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name }));
    const me = await agent.get('/api/user/data');
    agent.id = me.body.userData._id;
    return agent;
};

// alice owns the group, bob and dave are members, carol is an outsider.
const setup = async () => {
    const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
    const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
    const carol = await signUp('carol@student.fatima.edu.ph', 'Carol');
    const dave = await signUp('dave@student.fatima.edu.ph', 'Dave');

    const created = await alice.post('/api/groups').send({ name: 'Study Squad' });
    const group = created.body.group;
    await bob.post('/api/groups/join').send({ joinCode: group.joinCode });
    await dave.post('/api/groups/join').send({ joinCode: group.joinCode });
    return { alice, bob, carol, dave, group };
};

describe('family-friendly word filter', () => {
    test('catches blocked words, including disguised ones', () => {
        ['what the fuck', 'this is SHIT', 'sh1t', 'f.u.c.k', 'fuuuuck', 'f u c k', 'ang gago mo', 'tangina'].forEach((text) => {
            expect(containsProfanity(text), text).toBe(true);
        });
    });

    test('leaves ordinary words alone', () => {
        ['Please assess the class assignment', 'Room 455 at 3pm', 'Scunthorpe is a town', 'the assistant', 'grass and glass', 'leche flan', 'Lady Gaga', 'Study for the mass exam'].forEach((text) => {
            expect(containsProfanity(text), text).toBe(false);
        });
    });
});

describe('family-friendly groups', () => {
    test('are off by default and only block words once an admin turns them on', async () => {
        const { alice, bob, group } = await setup();
        expect(group.familyFriendly).toBe(false);

        const open = await bob.post(`/api/groups/${group._id}/messages`).send({ text: 'this is bullshit' });
        expect(open.body.success).toBe(true);

        const on = await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });
        expect(on.body.group.familyFriendly).toBe(true);

        const blocked = await bob.post(`/api/groups/${group._id}/messages`).send({ text: 'this is bullshit' });
        expect(blocked.status).toBe(400);
        expect(blocked.body.code).toBe('family_filter');

        const fine = await bob.post(`/api/groups/${group._id}/messages`).send({ text: 'see you at the library' });
        expect(fine.body.success).toBe(true);
    });

    test('also check the title of a shared task', async () => {
        const { alice, bob, group } = await setup();
        await alice.patch(`/api/groups/${group._id}`).send({ familyFriendly: true });

        const task = await bob.post('/api/tasks').send({
            title: 'Fuck this essay', course: 'ENG 101', dueDate: '2030-01-15', hours: 2, difficulty: 3, importance: 3,
        });
        const taskId = task.body.task?._id;
        expect(taskId).toBeTruthy();
        const shared = await bob.post(`/api/groups/${group._id}/messages`).send({ taskId });
        expect(shared.status).toBe(400);
    });

    test('can be chosen when the group is created', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.post('/api/groups').send({ name: 'Clean chat', familyFriendly: true });
        expect(res.body.group.familyFriendly).toBe(true);
    });
});

describe('group roles', () => {
  test('the owner can promote a member, who then can edit the group', async () => {
        const { alice, bob, group } = await setup();

        const before = await bob.patch(`/api/groups/${group._id}`).send({ name: 'Bob was here' });
        expect(before.status).toBe(403);

        const promoted = await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });
        expect(promoted.body.success).toBe(true);
        expect(promoted.body.group.admins).toContain(bob.id);

        const after = await bob.patch(`/api/groups/${group._id}`).send({ name: 'Renamed', description: 'New blurb', familyFriendly: true });
        expect(after.body.group.name).toBe('Renamed');
        expect(after.body.group.familyFriendly).toBe(true);
    });

    test('only the owner can promote or demote', async () => {
        const { alice, bob, dave, group } = await setup();
        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });

        const promote = await bob.post(`/api/groups/${group._id}/admins`).send({ userId: dave.id });
        expect(promote.status).toBe(403);

        const demote = await alice.delete(`/api/groups/${group._id}/admins/${bob.id}`);
        expect(demote.body.group.admins).not.toContain(bob.id);
        const edit = await bob.patch(`/api/groups/${group._id}`).send({ name: 'Nope' });
        expect(edit.status).toBe(403);
    });

    test('cannot promote someone outside the group', async () => {
        const { alice, carol, group } = await setup();
        const res = await alice.post(`/api/groups/${group._id}/admins`).send({ userId: carol.id });
        expect(res.status).toBe(404);
    });

    test('admins can remove regular members, but not the owner or other admins', async () => {
        const { alice, bob, dave, carol, group } = await setup();
        await carol.post('/api/groups/join').send({ joinCode: group.joinCode });
        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });
        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: dave.id });

        expect((await bob.delete(`/api/groups/${group._id}/members/${alice.id}`)).status).toBe(403);
        expect((await bob.delete(`/api/groups/${group._id}/members/${dave.id}`)).status).toBe(403);

        const kicked = await bob.delete(`/api/groups/${group._id}/members/${carol.id}`);
        expect(kicked.body.success).toBe(true);
        expect(kicked.body.group.members.map((m) => m._id)).not.toContain(carol.id);

        // The owner can remove an admin.
        const ownerKick = await alice.delete(`/api/groups/${group._id}/members/${dave.id}`);
        expect(ownerKick.body.success).toBe(true);
        expect(ownerKick.body.group.admins).not.toContain(dave.id);
    });

    test('regular members cannot remove anyone', async () => {
        const { bob, dave, group } = await setup();
        const res = await bob.delete(`/api/groups/${group._id}/members/${dave.id}`);
        expect(res.status).toBe(403);
    });

    test('an admin who leaves stops being an admin', async () => {
        const { alice, bob, group } = await setup();
        await alice.post(`/api/groups/${group._id}/admins`).send({ userId: bob.id });
        await bob.post('/api/groups/leave').send({ groupId: group._id });

        const groups = await alice.get('/api/groups');
        expect(groups.body.groups[0].admins).not.toContain(bob.id);
    });
});

describe('group icons', () => {
    test('an admin can set and clear the icon', async () => {
        const { alice, group } = await setup();
        const set = await alice.patch(`/api/groups/${group._id}`).send({ icon: PICTURE });
        expect(set.body.group.icon).toBe(PICTURE);

        const cleared = await alice.patch(`/api/groups/${group._id}`).send({ icon: '' });
        expect(cleared.body.group.icon).toBe('');
    });

    test('rejects things that are not small images', async () => {
        const { alice, group } = await setup();
        const notImage = await alice.patch(`/api/groups/${group._id}`).send({ icon: 'javascript:alert(1)' });
        expect(notImage.status).toBe(400);

        const huge = await alice.patch(`/api/groups/${group._id}`).send({ icon: `data:image/jpeg;base64,${'A'.repeat(30 * 1024)}` });
        expect(huge.status).toBe(400);
    });
});

describe('profile pictures', () => {
    test('a user can set and remove their own picture', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const set = await alice.put('/api/user/avatar').send({ avatar: PICTURE });
        expect(set.body.avatar).toBe(PICTURE);

        const me = await alice.get('/api/user/data');
        expect(me.body.userData.avatar).toBe(PICTURE);

        const removed = await alice.put('/api/user/avatar').send({ avatar: '' });
        expect(removed.body.avatar).toBe('');
    });

    test('rejects a non-image', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.put('/api/user/avatar').send({ avatar: 'https://evil.example/tracker.gif' });
        expect(res.status).toBe(400);
    });

    test('friends come back with their picture', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const bob = await signUp('bob@student.fatima.edu.ph', 'Bob');
        await bob.put('/api/user/avatar').send({ avatar: PICTURE });

        const sent = await alice.post('/api/friends/request').send({ userId: bob.id });
        expect(sent.body.success).toBe(true);
        const pending = await bob.get('/api/friends/pending');
        await bob.put(`/api/friends/accept/${pending.body.requests[0]._id}`);

        const friends = await alice.get('/api/friends');
        expect(friends.body.friends[0].avatar).toBe(PICTURE);
    });
});

describe('viewing another profile', () => {
    test('a groupmate can be viewed, with their relation and shared groups', async () => {
        const { alice, bob } = await setup();
        await bob.put('/api/user/profile').send({ bio: 'Third year, coffee first.' });

        const res = await alice.get(`/api/user/profile/${bob.id}`);
        expect(res.body.profile.name).toBe('Bob');
        expect(res.body.profile.bio).toBe('Third year, coffee first.');
        expect(res.body.profile.relation).toBe('none');
        expect(res.body.profile.sharedGroups).toHaveLength(1);
    });

    test('never includes email or check-in results', async () => {
        const { alice, bob } = await setup();
        const res = await alice.get(`/api/user/profile/${bob.id}`);
        const keys = Object.keys(res.body.profile);
        expect(keys).not.toContain('email');
        expect(keys).not.toContain('latestPSSScore');
        expect(keys).not.toContain('latestWHOScore');
    });

    test('a stranger with no group or friendship in common is refused', async () => {
        const { alice, carol } = await setup();
        const res = await alice.get(`/api/user/profile/${carol.id}`);
        expect(res.status).toBe(403);
    });

    test('an unknown or malformed id is a 404', async () => {
        const { alice } = await setup();
        expect((await alice.get('/api/user/profile/not-an-id')).status).toBe(404);
        expect((await alice.get('/api/user/profile/64b000000000000000000000')).status).toBe(404);
    });

    test('reports a sent and a received friend request', async () => {
        const { alice, bob } = await setup();
        await alice.post('/api/friends/request').send({ userId: bob.id });

        const fromAlice = await alice.get(`/api/user/profile/${bob.id}`);
        expect(fromAlice.body.profile.relation).toBe('sent');

        const fromBob = await bob.get(`/api/user/profile/${alice.id}`);
        expect(fromBob.body.profile.relation).toBe('received');
        expect(fromBob.body.profile.requestId).toBeTruthy();
    });

    test('a bio over 200 characters is refused', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        const res = await alice.put('/api/user/profile').send({ bio: 'x'.repeat(201) });
        expect(res.body.success).toBe(false);
    });
});

describe('friend requests by user id', () => {
    test('cannot add yourself or an unknown id', async () => {
        const alice = await signUp('alice@student.fatima.edu.ph', 'Alice');
        expect((await alice.post('/api/friends/request').send({ userId: alice.id })).status).toBe(400);
        expect((await alice.post('/api/friends/request').send({ userId: 'nope' })).status).toBe(404);
    });
});
