// Stands in for R2 in tests, the UI harness and local dev. Same three operations as r2Store, and
// presignGet hands out an expiring HMAC token for the dev link route instead of a signed R2 URL.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { StoreError, assertAsciiHeaders, assertExpiresIn, assertStoreKey } from './storeError.js';

export const DEV_LINK_PREFIX = '/api/files/dev/';

const encodePayload = (key, expiresAt) => Buffer.from(JSON.stringify([key, expiresAt])).toString('base64url');

export const createMemoryStore = () => {
    const objects = new Map(); // key -> { buffer, headers }
    const reads = new Map(); // key -> how many times a dev link was opened
    const pendingFailures = new Set();
    // Per store instance and never from env, so a token can't be forged or outlive the process.
    const secret = randomBytes(32);

    const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');

    const failIfAsked = (op, key) => {
        if (pendingFailures.delete(op)) throw new StoreError('InjectedFailure', { key, status: 500 });
    };

    return {
        name: 'memory',

        async put(key, buffer, headers = {}) {
            assertStoreKey(key);
            assertAsciiHeaders(headers, key);
            failIfAsked('put', key);
            const lowerCased = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
            objects.set(key, { buffer: Buffer.from(buffer), headers: lowerCased });
        },

        async remove(key) {
            assertStoreKey(key);
            failIfAsked('remove', key);
            objects.delete(key);
        },

        async presignGet(key, { expiresIn, now = Date.now() }) {
            assertStoreKey(key);
            assertExpiresIn(expiresIn, key);
            const payload = encodePayload(key, now + expiresIn * 1000);
            return `${DEV_LINK_PREFIX}${payload}.${sign(payload)}`;
        },

        // { object: { buffer, headers } } for a good link, otherwise { reason: 'bad' | 'expired' | 'gone' }.
        openDevLink(token, now = Date.now()) {
            const [payload, signature, ...extra] = String(token).split('.');
            if (!payload || !signature || extra.length) return { reason: 'bad' };
            const expected = Buffer.from(sign(payload));
            const given = Buffer.from(signature);
            if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { reason: 'bad' };
            const [key, expiresAt] = JSON.parse(Buffer.from(payload, 'base64url').toString());
            if (now > expiresAt) return { reason: 'expired' };
            const object = objects.get(key);
            if (!object) return { reason: 'gone' };
            reads.set(key, (reads.get(key) ?? 0) + 1);
            return { object: { buffer: Buffer.from(object.buffer), headers: { ...object.headers } } };
        },

        // Test helpers.
        size: () => objects.size,
        keys: () => [...objects.keys()],
        devReads: (key) => reads.get(key) ?? 0,
        failNext: (op) => pendingFailures.add(op),
        reset() {
            objects.clear();
            reads.clear();
            pendingFailures.clear();
        },
    };
};
