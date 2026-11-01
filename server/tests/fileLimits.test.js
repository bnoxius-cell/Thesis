import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { filesAvailability, getFileLimits, reloadFileLimits } from '../utils/fileLimits.js';

const MIB = 1024 * 1024;
const R2_ENV = {
    R2_ACCOUNT_ID: 'acc',
    R2_ACCESS_KEY_ID: 'fake-key-id',
    R2_SECRET_ACCESS_KEY: 'fake-secret',
    R2_BUCKET: 'bucket',
    CF_ANALYTICS_TOKEN: 'fake-token',
};

const withEnv = (vars) => {
    for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value);
    return reloadFileLimits();
};
const productionEnv = (extra = {}) => ({ NODE_ENV: 'production', FILES_ENABLED: 'true', ...R2_ENV, ...extra });

let warn;
beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllEnvs();
    reloadFileLimits();
    warn.mockRestore();
});

describe('limits', () => {
    test('unset env gives the plan defaults', () => {
        const limits = reloadFileLimits();
        expect(limits.storageCapBytes).toBe(5000 * MIB);
        expect(limits.classAMonthlyCap).toBe(100_000);
        expect(limits.classBMonthlyCap).toBe(1_000_000);
        expect(limits.uploadMonthlyBytes).toBe(1000 * MIB);
        expect(limits.linkTtlSeconds).toBe(60);
        expect(limits.userStorageBytes).toBe(100 * MIB);
        expect(limits.maxFileBytes).toBe(10 * MIB);
        expect(warn).not.toHaveBeenCalled();
    });

    test('a value above its ceiling is cut to the ceiling with one warning', () => {
        const limits = withEnv({ FILE_STORAGE_CAP_MB: '999999' });
        expect(limits.storageCapBytes).toBe(8000 * MIB);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(withEnv({ FILE_CLASS_B_MONTHLY_CAP: '5000000' }).classBMonthlyCap).toBe(1_500_000);
        expect(withEnv({ FILE_CLASS_A_MONTHLY_CAP: '999999' }).classAMonthlyCap).toBe(400_000);
        expect(withEnv({ FILE_UPLOAD_MONTHLY_MB: '999999' }).uploadMonthlyBytes).toBe(2000 * MIB);
    });

    test('a lower valid value is used as given', () => {
        const limits = withEnv({ FILE_CLASS_A_MONTHLY_CAP: '5', FILE_STORAGE_CAP_MB: '20' });
        expect(limits.classAMonthlyCap).toBe(5);
        expect(limits.storageCapBytes).toBe(20 * MIB);
        expect(warn).not.toHaveBeenCalled();
    });

    test('the link lifetime stays between 10 and 120 seconds', () => {
        expect(withEnv({ FILE_LINK_TTL_SECONDS: '3' }).linkTtlSeconds).toBe(10);
        expect(withEnv({ FILE_LINK_TTL_SECONDS: '600' }).linkTtlSeconds).toBe(120);
        expect(withEnv({ FILE_LINK_TTL_SECONDS: '90' }).linkTtlSeconds).toBe(90);
    });

    test.each(['abc', '0', '-5', '', '12.5', 'Infinity', '1e999', '1e3', '0x10', '+5', '5 000'])('%j falls back to the default, never "unlimited"', (raw) => {
        expect(withEnv({ FILE_CLASS_A_MONTHLY_CAP: raw }).classAMonthlyCap).toBe(100_000);
    });

    test('the owner page list is trimmed and lower-cased, and empty when unset', () => {
        expect(reloadFileLimits().adminEmails).toEqual([]);
        expect(withEnv({ FILES_ADMIN_EMAILS: ' Owner@Example.com , ,two@example.com' }).adminEmails).toEqual(['owner@example.com', 'two@example.com']);
    });

    test('the limits object can not be changed', () => {
        const limits = reloadFileLimits();
        expect(Object.isFrozen(limits)).toBe(true);
        expect(() => { limits.classAMonthlyCap = 1; }).toThrow();
    });

    test('getFileLimits keeps one object until reloadFileLimits', () => {
        const first = getFileLimits();
        expect(getFileLimits()).toBe(first);
        expect(reloadFileLimits()).not.toBe(first);
    });
});

describe('availability', () => {
    test('R2 is on only for the exact "true" in production with all five vars', () => {
        withEnv(productionEnv());
        expect(filesAvailability()).toEqual({ on: true, store: 'r2', reason: '' });
    });

    test.each(['', 'false', 'TRUE ', 'TRUE', '1', 'yes'])('FILES_ENABLED=%j is off', (value) => {
        withEnv(productionEnv({ FILES_ENABLED: value }));
        expect(filesAvailability()).toEqual({ on: false, store: null, reason: 'disabled' });
    });

    test.each(Object.keys(R2_ENV))('a missing %s is off', (name) => {
        withEnv(productionEnv({ [name]: '' }));
        expect(filesAvailability()).toEqual({ on: false, store: null, reason: 'not_configured' });
    });

    test('a var that is only spaces counts as missing', () => {
        withEnv(productionEnv({ R2_BUCKET: '   ' }));
        expect(filesAvailability().on).toBe(false);
    });

    test('outside production the memory store is used, even with every var set', () => {
        withEnv({ ...productionEnv(), NODE_ENV: 'test' });
        expect(filesAvailability()).toEqual({ on: true, store: 'memory', reason: '' });
        withEnv({ ...productionEnv(), NODE_ENV: 'development' });
        expect(filesAvailability().store).toBe('memory');
    });

    test('the limits object never holds a credential', () => {
        withEnv(productionEnv());
        expect(JSON.stringify(getFileLimits())).not.toMatch(/fake-secret|fake-key-id|fake-token/);
    });
});
