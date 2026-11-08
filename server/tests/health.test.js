import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectTestDB, closeTestDB } from './helpers/testDb.js';

beforeAll(connectTestDB);
afterAll(closeTestDB);

describe('GET /api/health', () => {
    test('reports the database and files as up, without needing a sign-in', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, db: 'up', files: 'on' });
    });

    test('answers 503 when the database cannot be reached', async () => {
        const original = mongoose.connection.db.admin;
        mongoose.connection.db.admin = () => ({ ping: () => Promise.reject(new Error('down')) });
        try {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(503);
            expect(res.body).toMatchObject({ ok: false, db: 'down' });
        } finally {
            mongoose.connection.db.admin = original;
        }
    });
});
