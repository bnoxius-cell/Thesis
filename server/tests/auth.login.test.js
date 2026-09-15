import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

const createLocalUser = async (password = 'Password123') => {
    const hashed = await bcrypt.hash(password, 10);
    return userModel.create({
        name: 'Test Student',
        email: 'test.student@student.fatima.edu.ph',
        password: hashed,
    });
};

describe('POST /api/auth/login', () => {
    test('rejects a missing email', async () => {
        const res = await request(app).post('/api/auth/login').send({ password: 'Password123' });
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/email is required/i);
    });

    test('rejects a missing password', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'test.student@student.fatima.edu.ph' });
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/password is required/i);
    });

    test('rejects an email that is not registered', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@student.fatima.edu.ph', password: 'Password123' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/user not found/i);
    });

    test('rejects the wrong password', async () => {
        await createLocalUser();

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'WrongPassword1' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/incorrect password/i);
    });

    test('rejects a password attempt on a Google-only account with a distinct message', async () => {
        const hashed = await bcrypt.hash('random-generated-password', 10);
        await userModel.create({
            name: 'Google User',
            email: 'test.student@student.fatima.edu.ph',
            password: hashed,
            authProvider: 'google',
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'WrongPassword1' });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/google sign-in/i);
    });

    test('logs in with correct credentials and sets a cookie', async () => {
        await createLocalUser();

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123' });

        expect(res.body.success).toBe(true);
        expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
    });

    test('login is case-insensitive on email', async () => {
        await createLocalUser();

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'Test.Student@Student.Fatima.Edu.PH', password: 'Password123' });

        expect(res.body.success).toBe(true);
    });

    test('rememberMe=true issues a longer-lived cookie than a normal login', async () => {
        await createLocalUser();

        const normal = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123' });
        const remembered = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test.student@student.fatima.edu.ph', password: 'Password123', rememberMe: true });

        const maxAge = (setCookieHeader) => Number(setCookieHeader.match(/Max-Age=(\d+)/i)?.[1]);

        expect(maxAge(remembered.headers['set-cookie'][0])).toBeGreaterThan(maxAge(normal.headers['set-cookie'][0]));
    });
});
