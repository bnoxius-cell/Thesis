import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

describe('task completedAt', () => {
    test('is set when a task is finished and cleared when it is reopened', async () => {
        const alice = request.agent(app);
        await alice.post('/api/auth/register').send(validRegisterPayload());
        const created = await alice.post('/api/tasks').send({ title: 'Report', course: 'CS 101', dueDate: '2026-11-01', hours: 2 });
        const id = created.body.task._id;
        expect(created.body.task.completedAt ?? null).toBeNull();

        const done = await alice.put(`/api/tasks/${id}`).send({ isCompleted: true });
        expect(done.status).toBe(200);
        expect(new Date(done.body.task.completedAt).getTime()).toBeGreaterThan(Date.now() - 5000);

        const stamp = done.body.task.completedAt;
        const again = await alice.put(`/api/tasks/${id}`).send({ isCompleted: true });
        expect(again.body.task.completedAt).toBe(stamp);

        const reopened = await alice.put(`/api/tasks/${id}`).send({ isCompleted: false });
        expect(reopened.body.task.completedAt).toBeNull();
    });
});
