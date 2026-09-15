import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

beforeAll(connectTestDB);
beforeEach(clearTestDB);
afterAll(closeTestDB);

describe('POST /api/auth/is-authenticated (exercises userAuth middleware end-to-end)', () => {
    test('rejects a request with no cookie at all', async () => {
        const res = await request(app).post('/api/auth/is-authenticated').send({});

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/unauthorized/i);
    });

    test('rejects a garbage/invalid token cookie', async () => {
        const res = await request(app)
            .post('/api/auth/is-authenticated')
            .set('Cookie', ['token=not-a-real-jwt'])
            .send({});

        expect(res.body.success).toBe(false);
    });

    test('accepts a valid token cookie from a real login', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());

        const res = await agent.post('/api/auth/is-authenticated').send({});

        expect(res.body.success).toBe(true);
    });
});

describe('POST /api/auth/logout', () => {
    test('clears the auth cookie', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());

        const res = await agent.post('/api/auth/logout').send({});

        expect(res.body.success).toBe(true);
        const cleared = res.headers['set-cookie']?.[0];
        expect(cleared).toMatch(/^token=;/); // cleared cookies are re-set to an empty value

        // A cookie previously issued to this agent should no longer authenticate
        // it for a protected route (the agent's cookie jar now holds the cleared cookie).
        const followUp = await agent.post('/api/auth/is-authenticated').send({});
        expect(followUp.body.success).toBe(false);
    });
});
