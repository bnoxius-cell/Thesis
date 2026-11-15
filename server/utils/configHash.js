import { createHash } from 'node:crypto';

// The variables that must match on every backend. A mismatch would change behaviour at a switch
// (a different JWT_SECRET logs everyone out), so the hash covers their names and values only.
export const CONFIG_HASH_KEYS = [
    'JWT_SECRET',
    'MONGO_URI',
    'CLIENT_URL',
    'FILES_ENABLED',
    'GEMINI_API_KEY',
    'GEMINI_MODEL',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
];

// Returns 12 hex characters. Missing variables count as empty. The result never contains a value
// in readable form, so it is safe to publish from /api/health.
export const configHash = (env = process.env) => {
    const pairs = [...CONFIG_HASH_KEYS].sort().map((name) => `${name}=${env[name] ?? ''}`);
    return createHash('sha256').update(pairs.join('\n')).digest('hex').slice(0, 12);
};
