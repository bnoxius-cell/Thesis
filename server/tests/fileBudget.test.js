import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import userModel from '../models/userModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import { reloadFileLimits, setFileLimitsForTests } from '../utils/fileLimits.js';
import { sendOwnerAlertEmail } from '../utils/emailService.js';
import {
    FileLimitError, fileError, monthId, nextMonthStart, releaseGlobalStorage, releaseUserStorage, reserveGlobalStorage,
    reserveLinks, reserveMonth, reserveUserDay, reserveUserStorage,
} from '../utils/fileBudget.js';

vi.mock('../utils/emailService.js', () => ({ sendOwnerAlertEmail: vi.fn().mockResolvedValue(undefined) }));

const MIB = 1024 * 1024;
const NOW = new Date('2026-11-15T10:00:00Z');

let user;
let logs;
beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    vi.mocked(sendOwnerAlertEmail).mockClear();
    logs = [vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {})];
    reloadFileLimits();
    user = await userModel.create({ name: 'Ana', email: 'ana@student.fatima.edu.ph' });
});
afterEach(() => logs.forEach((spy) => spy.mockRestore()));
afterAll(async () => {
    reloadFileLimits();
    await closeTestDB();
});

const month = () => fileUsageModel.findById(monthId(NOW)).lean();
const usedBytes = async () => (await userModel.findById(user._id).lean()).storageUsedBytes;

describe('errors', () => {
    test('paused messages name the next month in Philippine time', () => {
        const error = fileError('links_paused', { resumesAt: nextMonthStart(NOW) });
        expect(error).toBeInstanceOf(FileLimitError);
        expect(error).toMatchObject({ status: 503, code: 'files_paused' });
        expect(error.message).toContain('December 1');
        expect(error.resumesAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    });

    test('the quota message follows the per-student limit', () => {
        expect(fileError('quota_full').message).toBe("You've used your 100 MB. Delete a file to make room.");
        setFileLimitsForTests({ userStorageBytes: 50 * MIB });
        expect(fileError('quota_full').message).toContain('50 MB');
    });

    test('nextMonthStart rolls over the year', () => {
        expect(nextMonthStart(new Date('2026-12-31T23:59:59Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
});

describe('student storage', () => {
    test('refuses past the quota and leaves the counter unchanged', async () => {
        await reserveUserStorage(user._id, 90 * MIB);
        await expect(reserveUserStorage(user._id, 11 * MIB)).rejects.toMatchObject({ status: 413, code: 'quota_full' });
        expect(await usedBytes()).toBe(90 * MIB);
        await reserveUserStorage(user._id, 10 * MIB);
        expect(await usedBytes()).toBe(100 * MIB);
    });

    test('a student from before files existed starts at 0', async () => {
        await userModel.collection.updateOne({ _id: user._id }, { $unset: { storageUsedBytes: '' } });
        await reserveUserStorage(user._id, 5 * MIB);
        expect(await usedBytes()).toBe(5 * MIB);
    });

    test('release never goes below 0', async () => {
        await reserveUserStorage(user._id, 5);
        await releaseUserStorage(user._id, 50);
        expect(await usedBytes()).toBe(0);
    });

    test('a negative or fractional size is a bug, not a refund', async () => {
        await expect(reserveUserStorage(user._id, -5)).rejects.toThrow(TypeError);
        await expect(releaseUserStorage(user._id, 1.5)).rejects.toThrow(TypeError);
    });
});

describe('server storage', () => {
    test('refuses past the cap and release clamps at 0', async () => {
        setFileLimitsForTests({ storageCapBytes: 10 * MIB });
        await reserveGlobalStorage(8 * MIB, NOW);
        await expect(reserveGlobalStorage(3 * MIB, NOW)).rejects.toMatchObject({ status: 503, code: 'storage_full' });
        expect((await fileUsageModel.findById('storage').lean()).bytes).toBe(8 * MIB);
        await releaseGlobalStorage(20 * MIB);
        expect((await fileUsageModel.findById('storage').lean()).bytes).toBe(0);
    });
});

describe('month', () => {
    test('a link batch that does not fit takes nothing', async () => {
        setFileLimitsForTests({ classBMonthlyCap: 10 });
        await reserveMonth({ classB: 8 }, NOW);
        await expect(reserveMonth({ classB: 3 }, NOW)).rejects.toMatchObject({ code: 'files_paused' });
        expect((await month()).classB).toBe(8);
    });

    test('tripped reads block links only; tripped writes block uploads only', async () => {
        await reserveMonth({ classA: 1 }, NOW);
        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.reads': 'uncounted_reads' } });
        await expect(reserveMonth({ classB: 1 }, NOW)).rejects.toMatchObject({ code: 'files_paused' });
        await reserveMonth({ classA: 1, uploadBytes: 10 }, NOW);

        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.reads': '', 'tripped.writes': 'uncounted_writes' } });
        await expect(reserveMonth({ classA: 1 }, NOW)).rejects.toMatchObject({ code: 'files_paused' });
        await reserveMonth({ classB: 1 }, NOW);
        expect(await month()).toMatchObject({ classA: 2, classB: 1 });
    });

    test('analytics down pauses links without a date', async () => {
        await reserveMonth({ classA: 1 }, NOW);
        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.reads': 'analytics_down' } });
        const error = await reserveMonth({ classB: 1 }, NOW).catch((caught) => caught);
        expect(error).toMatchObject({ code: 'files_paused', resumesAt: null });
        expect(error.message).toBe("Files can't be opened right now. Try again in a little while.");
    });

    test('a new month starts empty and untripped', async () => {
        setFileLimitsForTests({ classAMonthlyCap: 1 });
        await reserveMonth({ classA: 1 }, NOW);
        await fileUsageModel.updateOne({ _id: monthId(NOW) }, { $set: { 'tripped.writes': 'uncounted_writes' } });
        await expect(reserveMonth({ classA: 1 }, NOW)).rejects.toMatchObject({ code: 'files_paused' });

        const december = new Date('2026-12-01T00:00:01Z');
        await reserveMonth({ classA: 1 }, december);
        expect(await fileUsageModel.findById('month:2026-12').lean())
            .toMatchObject({ classA: 1, tripped: { reads: '', writes: '' } });
    });
});

describe('daily limits', () => {
    test('links: 400 a day, and a batch that would pass it takes nothing', async () => {
        await reserveLinks(user._id, 390, NOW);
        await expect(reserveLinks(user._id, 11, NOW)).rejects.toMatchObject({ status: 429, code: 'daily_limit' });
        await reserveLinks(user._id, 10, NOW);
        expect((await month()).classB).toBe(400);
        await expect(reserveUserDay(user._id, { links: 1 }, new Date('2026-11-15T23:59:59Z'))).rejects
            .toMatchObject({ message: "You've opened a lot of files today. Try again tomorrow." });
        await reserveUserDay(user._id, { links: 1 }, new Date('2026-11-16T00:00:00Z'));
    });
});

describe('alerts', () => {
    test('each threshold emails once a month, only when an address is set', async () => {
        setFileLimitsForTests({ classAMonthlyCap: 10 });
        await reserveMonth({ classA: 5 }, NOW);
        expect(sendOwnerAlertEmail).not.toHaveBeenCalled();
        expect((await month()).alerts).toEqual(['classA:50']);

        setFileLimitsForTests({ classAMonthlyCap: 10, alertEmail: 'owner@example.com' });
        await reserveMonth({ classA: 3 }, NOW);
        await reserveMonth({ classA: 0, classB: 0 }, NOW);
        expect(sendOwnerAlertEmail).toHaveBeenCalledTimes(1);
        expect(vi.mocked(sendOwnerAlertEmail).mock.calls[0][0]).toBe('owner@example.com');
        expect(vi.mocked(sendOwnerAlertEmail).mock.calls[0][1]).toContain('80%');

        await reserveMonth({ classA: 2 }, NOW);
        expect(sendOwnerAlertEmail).toHaveBeenCalledTimes(2);
        expect(vi.mocked(sendOwnerAlertEmail).mock.calls[1][1]).toContain('100%');
        expect((await month()).alerts.sort()).toEqual(['classA:100', 'classA:50', 'classA:80']);
    });

    test('a failing alert email never fails the reservation', async () => {
        setFileLimitsForTests({ classAMonthlyCap: 2, alertEmail: 'owner@example.com' });
        vi.mocked(sendOwnerAlertEmail).mockRejectedValueOnce(new Error('mail down'));
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        await reserveMonth({ classA: 2 }, NOW);
        await new Promise((resolve) => setImmediate(resolve));
        expect(error).toHaveBeenCalledWith('[files] alert email failed:', 'mail down');
        error.mockRestore();
    });
});
