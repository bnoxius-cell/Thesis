import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import taskModel from '../models/taskModel.js';
import scheduleModel from '../models/scheduleModel.js';
import reviewerModel from '../models/reviewerModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterEach(() => vi.restoreAllMocks());
afterAll(closeTestDB);

const cookieOf = (user) => `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`;
const makeUser = (n = 1) => userModel.create({ name: `Student ${n}`, email: `s${n}@student.fatima.edu.ph`, password: 'hash' });
const as = (user) => ({
    get: (url) => request(app).get(url).set('Cookie', cookieOf(user)),
    post: (url, body) => request(app).post(url).set('Cookie', cookieOf(user)).send(body),
});

const entry = { title: 'Math', days: [1], startTime: '08:00', endTime: '09:00' };
const addSchedule = (owner, entries = [entry], extra = {}) => scheduleModel.create({ title: 'Timetable', owner: owner._id, entries, ...extra });
const addTask = (owner) => taskModel.create({ title: 'Essay', dueDate: new Date(Date.now() + 864e5), owner: owner._id });
const addReviewer = (owner) => reviewerModel.create({ title: 'Notes', owner: owner._id });

const ALL_FALSE = { welcomeDone: false, setupHidden: false, setupDone: false };
const NO_STEPS = { classes: false, task: false, reviewer: false, checkin: false };
const getGuide = async (user) => (await as(user).get('/api/user/data')).body.userData.guide;
const getSteps = async (user) => (await as(user).get('/api/user/setup')).body.steps;

describe('guide flags', () => {
    test('a new user has every flag false in /data', async () => {
        const user = await makeUser();
        expect(await getGuide(user)).toEqual(ALL_FALSE);
    });

    test.each([
        ['welcome-done', { welcomeDone: true }],
        ['setup-hide', { setupHidden: true }],
    ])('%s flips only its own flag', async (action, change) => {
        const user = await makeUser();
        const res = await as(user).post('/api/user/guide', { action });
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, guide: { ...ALL_FALSE, ...change } });
        expect(await getGuide(user)).toEqual({ ...ALL_FALSE, ...change });
    });

    test('welcome-done twice keeps the first date', async () => {
        const user = await makeUser();
        await as(user).post('/api/user/guide', { action: 'welcome-done' });
        const first = (await userModel.findById(user._id)).guide.welcomeDoneAt;
        const res = await as(user).post('/api/user/guide', { action: 'welcome-done' });
        expect(res.body.guide.welcomeDone).toBe(true);
        expect((await userModel.findById(user._id)).guide.welcomeDoneAt).toEqual(first);
    });

    test('setup-show after setup-hide gives false again', async () => {
        const user = await makeUser();
        await as(user).post('/api/user/guide', { action: 'setup-hide' });
        const res = await as(user).post('/api/user/guide', { action: 'setup-show' });
        expect(res.body.guide.setupHidden).toBe(false);
        expect(await getGuide(user)).toEqual(ALL_FALSE);
    });

    test('a bad action and a missing body answer 400', async () => {
        const user = await makeUser();
        for (const body of [{ action: 'nope' }, { action: 'toString' }, {}, undefined]) {
            const res = await as(user).post('/api/user/guide', body);
            expect(res.status).toBe(400);
            expect(res.body).toEqual({ success: false, message: "That isn't a guide action." });
        }
    });
});

describe('GET /api/user/setup', () => {
    test('a new user has nothing done', async () => {
        const user = await makeUser();
        const res = await as(user).get('/api/user/setup');
        expect(res.body).toEqual({ success: true, steps: NO_STEPS, done: false });
    });

    test('a task ticks task', async () => {
        const user = await makeUser();
        await addTask(user);
        expect((await getSteps(user)).task).toBe(true);
    });

    test('a timetable needs an entry to tick classes', async () => {
        const user = await makeUser();
        await addSchedule(user, [], { isMain: true });
        expect((await getSteps(user)).classes).toBe(false);
        await addSchedule(user, [entry]);
        expect((await getSteps(user)).classes).toBe(true);
    });

    test("joining someone else's timetable with entries ticks classes", async () => {
        const owner = await makeUser(1);
        const member = await makeUser(2);
        await addSchedule(owner, [entry], { collaborators: [{ user: member._id }] });
        expect((await getSteps(member)).classes).toBe(true);
    });

    test('a reviewer ticks reviewer, even while it is processing', async () => {
        const user = await makeUser();
        const reviewer = await addReviewer(user);
        expect(reviewer.status).toBe('processing');
        expect((await getSteps(user)).reviewer).toBe(true);
    });

    test('a WHO-5 check-in alone ticks checkin', async () => {
        const user = await makeUser();
        await userModel.updateOne({ _id: user._id }, { lastWHOSubmission: new Date() });
        expect(await getSteps(user)).toEqual({ ...NO_STEPS, checkin: true });
    });

    test("another user's task, reviewer and timetable never count", async () => {
        const owner = await makeUser(1);
        const other = await makeUser(2);
        await Promise.all([addTask(owner), addReviewer(owner), addSchedule(owner)]);
        const res = await as(other).get('/api/user/setup');
        expect(res.body.steps).toEqual(NO_STEPS);
        expect(res.body.done).toBe(false);
    });

    test('with all four done, setup answers done and /data shows setupDone', async () => {
        const user = await makeUser();
        await Promise.all([addTask(user), addReviewer(user), addSchedule(user)]);
        await userModel.updateOne({ _id: user._id }, { lastPSSSubmission: new Date() });
        expect((await getGuide(user)).setupDone).toBe(false);

        const res = await as(user).get('/api/user/setup');
        expect(res.body.done).toBe(true);
        expect(Object.values(res.body.steps)).toEqual([true, true, true, true]);
        expect((await getGuide(user)).setupDone).toBe(true);
    });

    test('a database failure answers 500 with the plain message', async () => {
        const user = await makeUser();
        const cookie = cookieOf(user);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(userModel, 'findById').mockRejectedValueOnce(new Error('boom'));
        const res = await request(app).get('/api/user/setup').set('Cookie', cookie);
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Something went wrong on our side. Try again in a moment.');
    });
});
