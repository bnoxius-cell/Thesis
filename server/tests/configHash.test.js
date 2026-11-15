import { describe, test, expect } from 'vitest';
import { configHash, CONFIG_HASH_KEYS } from '../utils/configHash.js';

const secret = 'super-secret-jwt-value-123';
const env = () => ({
    JWT_SECRET: secret,
    MONGO_URI: 'mongodb+srv://user:pw@cluster.example.net/db',
    CLIENT_URL: 'https://stresscare.xyz',
    FILES_ENABLED: 'true',
    GEMINI_API_KEY: 'gemini-key-abc',
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    VAPID_PUBLIC_KEY: 'vapid-public',
    VAPID_PRIVATE_KEY: 'vapid-private',
    R2_ACCOUNT_ID: 'account',
    R2_ACCESS_KEY_ID: 'access',
    R2_SECRET_ACCESS_KEY: 'r2-secret-xyz',
});

describe('configHash', () => {
    test('same inputs give the same hash', () => {
        expect(configHash(env())).toBe(configHash(env()));
    });

    test('is 12 lowercase hex characters', () => {
        expect(configHash(env())).toMatch(/^[0-9a-f]{12}$/);
    });

    test.each(CONFIG_HASH_KEYS)('changing %s changes the hash', (name) => {
        const changed = { ...env(), [name]: 'a-different-value' };
        expect(configHash(changed)).not.toBe(configHash(env()));
    });

    test('key order of the input does not matter', () => {
        const reversed = Object.fromEntries(Object.entries(env()).reverse());
        expect(configHash(reversed)).toBe(configHash(env()));
    });

    test('a missing variable counts as empty', () => {
        expect(configHash({ ...env(), GEMINI_MODEL: undefined })).toBe(configHash({ ...env(), GEMINI_MODEL: '' }));
    });

    test('unrelated variables do not change the hash', () => {
        expect(configHash({ ...env(), PORT: '8080', NODE_ENV: 'production', SMTP_PASSWORD: 'x' }))
            .toBe(configHash(env()));
    });

    test('the output never contains a configured value', () => {
        const hash = configHash(env());
        for (const value of Object.values(env())) {
            expect(hash).not.toContain(value);
        }
        expect(hash).not.toContain(secret);
    });
});
