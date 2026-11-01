import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import userModel from '../models/userModel.js';
import fileModel from '../models/fileModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import { monthId } from '../utils/fileBudget.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { setFileStoreForTests } from '../utils/fileStore.js';
import { createMemoryStore } from '../utils/fileStores/memoryStore.js';
import { storeFile } from '../utils/storedFiles.js';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
    sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

const MIB = 1024 * 1024;
const OWNER_EMAIL = 'Owner@Student.Fatima.edu.ph';

let logs;
beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    logs = ['warn', 'log', 'error'].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    setFileLimitsForTests({ adminEmails: ['owner@student.fatima.edu.ph'] });
    setFileStoreForTests(createMemoryStore());
});
afterEach(() => logs.forEach((spy) => spy.mockRestore()));
afterAll(async () => {
    reloadFileLimits();
    await closeTestDB();
});

const makeUser = (overrides = {}) => userModel.create({ name: 'Owner', email: OWNER_EMAIL, isAccountVerified: true, ...overrides });
const getUsage = (user) => {
    const req = request(app).get('/api/files/usage');
    return user ? req.set('Cookie', `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`) : req;
};
const addFile = (owner, bytes = 1000) => storeFile({
    ownerId: owner._id,
    scope: 'subject',
    refs: { subject: owner._id },
    file: { buffer: Buffer.alloc(bytes, 1), name: 'notes.pdf', ext: 'pdf', mimeType: 'application/pdf' },
});

describe('GET /api/files/usage', () => {
    test('a verified listed account (any case) gets the counters, real numbers and trips', async () => {
        const owner = await makeUser();
        await addFile(owner, 1000);
        await fileUsageModel.updateOne({ _id: monthId(new Date()) }, {
            $set: {
                classB: 7, 'real.classB': 9, 'real.classA': 3, 'real.storageBytes': 5000, 'real.checkedAt': new Date('2026-11-01T00:00:00Z'),
                'tripped.reads': 'uncounted_reads',
            },
        });

        const res = await getUsage(owner);
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('no-store');
        expect(res.body).toMatchObject({
            success: true,
            enabled: true,
            store: 'memory',
            used: { storageBytes: 1000, classA: 1, classB: 7, uploadBytes: 1000 },
            real: { classA: 3, classB: 9, storageBytes: 5000, checkedAt: '2026-11-01T00:00:00.000Z' },
            tripped: { reads: 'uncounted_reads', writes: '' },
            analyticsOk: true,
            ledgerBytes: 1000,
            drift: 0,
            rowsRemoving: 0,
        });
        expect(res.body.month).toMatch(/^\d{4}-\d{2}$/);
        expect(res.body.caps).toEqual({ storageBytes: 5000 * MIB, classA: 100_000, classB: 1_000_000, uploadBytes: 1000 * MIB });
        expect(res.body.percent).toEqual({ storageBytes: 0, classA: 0, classB: 0, uploadBytes: 0 });
        expect(new Date(res.body.resumesAt).getUTCDate()).toBe(1);
    });

    test('percent, drift and rows being removed come from the counters and the ledger', async () => {
        setFileLimitsForTests({ adminEmails: ['owner@student.fatima.edu.ph'], classBMonthlyCap: 8 });
        const owner = await makeUser();
        const kept = await addFile(owner, 1000);
        const going = await addFile(owner, 500);
        await fileModel.updateOne({ _id: going._id }, { $set: { state: 'removing' } });
        await fileUsageModel.updateOne({ _id: monthId(new Date()) }, { $set: { classB: 2 } });
        await fileUsageModel.updateOne({ _id: 'storage' }, { $inc: { bytes: 300 } }); // a counter that ran high

        const body = (await getUsage(owner)).body;
        expect(body.percent.classB).toBe(25);
        expect(body.ledgerBytes).toBe(kept.bytes + going.bytes);
        expect(body.drift).toBe(300);
        expect(body.rowsRemoving).toBe(1);
    });

    test('analytics are not "ok" until they have been read, or while reads keep failing', async () => {
        const owner = await makeUser();
        expect((await getUsage(owner)).body.analyticsOk).toBe(false);
        await fileUsageModel.updateOne({ _id: monthId(new Date()) }, { $set: { 'real.checkedAt': new Date(), analyticsFailures: 2 } }, { upsert: true });
        expect((await getUsage(owner)).body.analyticsOk).toBe(false);
    });

    test('with nothing recorded yet it answers zeros', async () => {
        const body = (await getUsage(await makeUser())).body;
        expect(body.used).toEqual({ storageBytes: 0, classA: 0, classB: 0, uploadBytes: 0 });
        expect(body.tripped).toEqual({ reads: '', writes: '' });
        expect(body.real.checkedAt).toBeNull();
    });

    test('files off is reported, not hidden', async () => {
        setFileLimitsForTests({ adminEmails: ['owner@student.fatima.edu.ph'], availability: { on: false, store: null, reason: 'disabled' } });
        expect((await getUsage(await makeUser())).body).toMatchObject({ enabled: false, store: null });
    });

    test('a listed email that is not verified gets a 404', async () => {
        const res = await getUsage(await makeUser({ isAccountVerified: false }));
        expect(res.status).toBe(404);
        expect(res.body.used).toBeUndefined();
    });

    test('a verified account that is not listed gets a 404', async () => {
        const res = await getUsage(await makeUser({ email: 'someone@student.fatima.edu.ph' }));
        expect(res.status).toBe(404);
    });

    test('with no list set nobody gets in', async () => {
        setFileLimitsForTests({});
        expect((await getUsage(await makeUser())).status).toBe(404);
    });

    test('signed out is Unauthorized', async () => {
        const res = await getUsage(null);
        expect(res.body).toEqual({ success: false, message: 'Unauthorized' });
    });

    test('the body never carries a storage key or a link', async () => {
        const owner = await makeUser();
        await addFile(owner);
        const text = JSON.stringify((await getUsage(owner)).body);
        expect(text).not.toMatch(/storageId|memory:|http|\/api\/files\/dev/);
    });
});
