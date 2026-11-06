import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import userModel from '../models/userModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { sendOwnerAlertEmail } from '../utils/emailService.js';
import { monthId, reserveLinks, reserveMonth } from '../utils/fileBudget.js';
import { reconcileUsage } from '../utils/storedFiles.js';

vi.mock('../utils/emailService.js', () => ({ sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined) }));

const MIB = 1024 * 1024;
const NOW = new Date('2026-11-15T10:00:00Z');
const TOKEN = 'cf-analytics-token-do-not-log';
const R2_ON = Object.freeze({ on: true, store: 'r2', reason: '' });
const ENV = { R2_ACCOUNT_ID: 'acc', R2_BUCKET: 'stresscare-files', CF_ANALYTICS_TOKEN: TOKEN };

let logs;
const useLimits = (availability = R2_ON) => setFileLimitsForTests({ availability, alertEmail: 'owner@example.com' });

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    vi.mocked(sendOwnerAlertEmail).mockClear();
    logs = ['warn', 'log', 'error'].map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    Object.assign(process.env, ENV);
    useLimits();
});
afterEach(() => {
    logs.forEach((spy) => spy.mockRestore());
    for (const name of [...Object.keys(ENV), 'FILES_RESUME_KEY']) process.env[name] = '';
});
afterAll(async () => {
    reloadFileLimits();
    await closeTestDB();
});

// Cloudflare answering with these totals for the month so far. `refusedReads` are GETs that failed
// authentication (expired or forged links), which Cloudflare doesn't bill.
const cloudflare = ({ classA = 0, classB = 0, storageBytes = 0, refusedReads = 0 } = {}) => vi.fn(async () => new Response(JSON.stringify({
    data: {
        viewer: {
            accounts: [{
                operations: [
                    { dimensions: { actionType: 'GetObject', responseStatusCode: 200 }, sum: { requests: classB } },
                    { dimensions: { actionType: 'GetObject', responseStatusCode: 403 }, sum: { requests: refusedReads } },
                    { dimensions: { actionType: 'PutObject', responseStatusCode: 200 }, sum: { requests: classA } },
                ],
                storage: [{ dimensions: { datetime: '2026-11-15T00:00:00Z' }, max: { payloadSize: storageBytes } }],
            }],
        },
    },
}), { status: 200 }));
const down = () => vi.fn(async () => new Response('', { status: 503 }));

// What we counted ourselves this month, and the bytes we count as stored.
const counted = ({ classA = 0, classB = 0, storageBytes = 0 } = {}) => Promise.all([
    fileUsageModel.create({ _id: monthId(NOW), classA, classB }),
    fileUsageModel.create({ _id: 'storage', bytes: storageBytes }),
]);

const month = () => fileUsageModel.findById(monthId(NOW)).lean();
const tripped = async () => (await month()).tripped;
const resumeKey = async () => (await fileUsageModel.findById('resume').lean())?.resumeKey ?? '';
const emails = () => vi.mocked(sendOwnerAlertEmail).mock.calls;
const allLogs = () => logs.flatMap((spy) => spy.mock.calls.flat()).map(String).join('\n');
const reconcile = (fetchImpl, now = NOW) => reconcileUsage(now, { fetchImpl });

describe('when it runs', () => {
    test('files off: no request to Cloudflare', async () => {
        useLimits(Object.freeze({ on: false, store: null, reason: 'disabled' }));
        const fetchImpl = cloudflare();
        expect(await reconcile(fetchImpl)).toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test('the memory store has no Cloudflare to ask', async () => {
        useLimits(Object.freeze({ on: true, store: 'memory', reason: '' }));
        const fetchImpl = cloudflare();
        expect(await reconcile(fetchImpl)).toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    test('asks from the 1st of the UTC month to now', async () => {
        const fetchImpl = cloudflare();
        await reconcile(fetchImpl);
        const { variables } = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(variables).toMatchObject({ bucket: 'stresscare-files', from: '2026-11-01T00:00:00.000Z', to: NOW.toISOString() });
    });
});

describe('counted vs real reads', () => {
    test('a gap inside the margin stores the real numbers and trips nothing', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 120_000 }));
        const doc = await month();
        expect(doc.real).toMatchObject({ classB: 120_000, checkedAt: NOW });
        expect(doc.tripped).toEqual({ reads: '', writes: '' });
        expect(emails()).toHaveLength(0);
        expect(allLogs()).toContain('classB=100000/1000000 (real 120000)');
    });

    test('over 25% trips reads once, emails once with the numbers, and blocks links but not uploads', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 130_001 }));
        expect(await tripped()).toEqual({ reads: 'uncounted_reads', writes: '' });
        expect(emails()).toHaveLength(1);
        const [to, subject, text] = emails()[0];
        expect(to).toBe('owner@example.com');
        expect(subject).toContain('uncounted_reads');
        expect(text).toContain('counted 100000');
        expect(text).toContain('real 130001');
        expect(`${subject}\n${text}`).not.toMatch(/http|Bearer|X-Amz/);
        expect(`${subject}\n${text}`).not.toContain(TOKEN);

        await reconcile(cloudflare({ classB: 140_000 }));
        expect(emails()).toHaveLength(1);

        const user = await userModel.create({ name: 'Ana', email: 'ana@student.fatima.edu.ph' });
        await expect(reserveLinks(user._id, 1, NOW)).rejects.toMatchObject({ status: 503, code: 'files_paused' });
        await expect(reserveMonth({ classA: 1, uploadBytes: 10 }, NOW)).resolves.toBeTruthy();
    });

    test('a flood of expired-link replays (403) trips nothing', async () => {
        await counted({ classB: 100 });
        await reconcile(cloudflare({ classB: 100, refusedReads: 3_000_000 }));
        expect(await tripped()).toEqual({ reads: '', writes: '' });
        expect((await month()).real.classB).toBe(100);
    });

    test('a small month uses the 25,000 floor', async () => {
        await counted({ classB: 10_000 });
        await reconcile(cloudflare({ classB: 35_000 }));
        expect((await tripped()).reads).toBe('');
        await reconcile(cloudflare({ classB: 35_001 }));
        expect((await tripped()).reads).toBe('uncounted_reads');
    });

    test('real reads reaching 2,500,000 trip read_line even when counted is close', async () => {
        await counted({ classB: 2_400_000 });
        await reconcile(cloudflare({ classB: 2_499_999 }));
        expect((await tripped()).reads).toBe('');
        await reconcile(cloudflare({ classB: 2_500_000 }));
        expect(await tripped()).toEqual({ reads: 'read_line', writes: '' });
    });
});

describe('counted vs real writes and storage', () => {
    test('real writes more than 5,000 over counted trip writes and say to consider the emergency stop', async () => {
        await counted({ classA: 100 });
        await reconcile(cloudflare({ classA: 5100 }));
        expect((await tripped()).writes).toBe('');
        await reconcile(cloudflare({ classA: 5101 }));
        expect(await tripped()).toEqual({ reads: '', writes: 'uncounted_writes' });
        expect(emails()[0][2]).toContain('5.7');
    });

    test('real writes reaching 250,000 trip writes', async () => {
        await counted({ classA: 250_000 });
        await reconcile(cloudflare({ classA: 250_000 }));
        expect((await tripped()).writes).toBe('uncounted_writes');
    });

    test('Cloudflare holding over 500 MiB more than we count trips writes', async () => {
        await counted({ storageBytes: 10 * MIB });
        await reconcile(cloudflare({ storageBytes: 510 * MIB }));
        expect((await tripped()).writes).toBe('');
        await reconcile(cloudflare({ storageBytes: 510 * MIB + 1 }));
        expect(await tripped()).toEqual({ reads: '', writes: 'storage_gap' });
    });

    test('a new month starts untripped', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 200_000 }));
        const december = new Date('2026-12-01T00:10:00Z');
        await reconcile(cloudflare({ classB: 0 }), december);
        expect((await fileUsageModel.findById(monthId(december)).lean()).tripped).toEqual({ reads: '', writes: '' });
    });
});

describe('when Cloudflare cannot be reached', () => {
    test('five failures trip nothing, the sixth pauses links and emails once, a success lifts it', async () => {
        for (let run = 0; run < 5; run += 1) await reconcile(down());
        expect(await month()).toMatchObject({ analyticsFailures: 5, tripped: { reads: '', writes: '' } });
        expect(emails()).toHaveLength(0);

        await reconcile(down());
        await reconcile(down());
        expect(await month()).toMatchObject({ analyticsFailures: 7, tripped: { reads: 'analytics_down' } });
        expect(emails()).toHaveLength(1);
        const user = await userModel.create({ name: 'Ana', email: 'ana@student.fatima.edu.ph' });
        await expect(reserveLinks(user._id, 1, NOW)).rejects.toMatchObject({ code: 'files_paused', resumesAt: null });

        await reconcile(cloudflare());
        expect(await month()).toMatchObject({ analyticsFailures: 0, tripped: { reads: '', writes: '' } });
    });

    test('one failure pauses links when the last good check is over an hour old, and a success lifts it', async () => {
        const later = (minutes) => new Date(NOW.getTime() + minutes * 60 * 1000);
        await reconcile(cloudflare());
        await reconcile(down(), later(59));
        expect((await tripped()).reads).toBe('');

        await reconcile(down(), later(61));
        expect(await month()).toMatchObject({ analyticsFailures: 2, tripped: { reads: 'analytics_down' } });
        expect(emails()).toHaveLength(1);

        await reconcile(cloudflare(), later(70));
        expect((await tripped()).reads).toBe('');
    });

    test('a new month does not start the hour over', async () => {
        await reconcile(cloudflare(), new Date('2026-11-30T23:30:00Z'));
        const december = new Date('2026-12-01T00:40:00Z');
        await reconcile(down(), december);
        expect(await fileUsageModel.findById(monthId(december)).lean())
            .toMatchObject({ analyticsFailures: 1, tripped: { reads: 'analytics_down' } });
    });

    test('a success keeps any other reason', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 200_000, storageBytes: 600 * MIB }));
        expect(await tripped()).toEqual({ reads: 'uncounted_reads', writes: 'storage_gap' });
        for (let run = 0; run < 6; run += 1) await reconcile(down());
        expect((await tripped()).reads).toBe('uncounted_reads');
        await reconcile(cloudflare({ classB: 100_000 }));
        expect(await tripped()).toEqual({ reads: 'uncounted_reads', writes: 'storage_gap' });
    });

    test('an HTTP 200 with GraphQL errors counts as a failure', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: null, errors: [{ message: 'x' }] }), { status: 200 }));
        expect(await reconcile(fetchImpl)).toEqual({ ok: false, code: 'graphql_errors' });
        expect((await month()).analyticsFailures).toBe(1);
    });

    test('no log line carries the token, even when the error message does', async () => {
        const leaky = vi.fn(async () => { throw new Error(`fetch failed Authorization: Bearer ${TOKEN}`); });
        for (let run = 0; run < 6; run += 1) await reconcile(leaky);
        await reconcile(cloudflare({ classB: 5 }));
        expect(allLogs()).toContain('usage check failed');
        expect(allLogs()).not.toContain(TOKEN);
        expect(allLogs()).not.toContain('Bearer');
        expect(emails().flat().join('\n')).not.toContain(TOKEN);
    });
});

describe('owner resume (FILES_RESUME_KEY)', () => {
    test('a new key clears trips once and accepts the gap; a bigger gap trips again; a newer key resumes again', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 130_001 }));
        expect((await tripped()).reads).toBe('uncounted_reads');

        process.env.FILES_RESUME_KEY = 'a';
        await reconcile(cloudflare({ classB: 130_001 }));
        expect(await month()).toMatchObject({ baseline: { classB: 30_001 }, tripped: { reads: '', writes: '' } });
        expect(await resumeKey()).toBe('a');
        expect(emails()).toHaveLength(2);

        await reconcile(cloudflare({ classB: 130_001 }));
        expect(await month()).toMatchObject({ baseline: { classB: 30_001 }, tripped: { reads: '' } });
        expect(emails()).toHaveLength(2);

        // Counted is now 130,001 with the baseline, so the margin is 32,500.25.
        await reconcile(cloudflare({ classB: 162_501 }));
        expect((await tripped()).reads).toBe('');
        await reconcile(cloudflare({ classB: 162_502 }));
        expect((await tripped()).reads).toBe('uncounted_reads');

        process.env.FILES_RESUME_KEY = 'b';
        await reconcile(cloudflare({ classB: 162_502 }));
        expect(await month()).toMatchObject({ baseline: { classB: 62_502 }, tripped: { reads: '' } });
        expect(await resumeKey()).toBe('b');
    });

    test('a key left in env carries into the next month and does not apply again', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 130_001 }));
        process.env.FILES_RESUME_KEY = 'a';
        await reconcile(cloudflare({ classB: 130_001 }));
        expect((await tripped()).reads).toBe('');
        expect(emails()).toHaveLength(2);

        const december = new Date('2026-12-02T10:00:00Z');
        await fileUsageModel.create({ _id: monthId(december), classB: 10 });
        await reconcile(cloudflare({ classB: 40_000 }), december);
        await reconcile(cloudflare({ classB: 40_000 }), new Date('2026-12-02T10:10:00Z'));
        const dec = await fileUsageModel.findById(monthId(december)).lean();
        expect(dec).toMatchObject({ tripped: { reads: 'uncounted_reads' }, baseline: { classB: 0 } });
        expect(emails().map(([, subject]) => subject).filter((subject) => subject.includes('resume'))).toHaveLength(1);
        expect(await resumeKey()).toBe('a');
    });

    test('an empty key never resumes', async () => {
        await counted({ classB: 100_000 });
        await reconcile(cloudflare({ classB: 130_001 }));
        process.env.FILES_RESUME_KEY = '  ';
        await reconcile(cloudflare({ classB: 130_001 }));
        expect((await tripped()).reads).toBe('uncounted_reads');
        expect(await resumeKey()).toBe('');
    });
});
