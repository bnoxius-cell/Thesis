import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import notificationModel from '../models/notificationModel.js';
import { connectTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

beforeAll(connectTestDB);
afterAll(closeTestDB);

// A JSON answer over 1 KB, so it clears compression's default threshold.
const bigJsonRoute = async () => {
    const agent = request.agent(app);
    const email = 'zed@student.fatima.edu.ph';
    await agent.post('/api/auth/register').send(validRegisterPayload({ email, name: 'Zed' }));
    const user = await userModel.findOne({ email });
    await notificationModel.insertMany(
        Array.from({ length: 20 }, (_, i) => ({ recipient: user._id, type: 'system', message: `Notification number ${i} with some padding text` })),
    );
    return agent;
};

describe('response compression', () => {
    test('gzips a large JSON answer when the client accepts it, and leaves it plain otherwise', async () => {
        const agent = await bigJsonRoute();

        const zipped = await agent.get('/api/notifications').set('Accept-Encoding', 'gzip');
        expect(zipped.headers['content-encoding']).toBe('gzip');
        expect(zipped.body.notifications).toHaveLength(20);

        const plain = await agent.get('/api/notifications').set('Accept-Encoding', 'identity');
        expect(plain.headers['content-encoding']).toBeUndefined();
    });
});
