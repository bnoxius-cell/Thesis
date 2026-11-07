// In-memory fixed-window limiter keyed by string. One server process, so no shared store;
// a restart forgets the counts, which is fine for abuse limits.
const MAX_KEYS = 10000;
const windows = new Map(); // key -> { count, resetAt }

const makeRoom = (now) => {
    for (const [key, entry] of windows) {
        if (entry.resetAt <= now) windows.delete(key);
    }
    // Still full of live windows: drop the oldest so memory stays bounded.
    while (windows.size >= MAX_KEYS) windows.delete(windows.keys().next().value);
};

// The live window for `key`, or a new empty one when it has none.
const windowFor = (key, windowMs, now) => {
    const entry = windows.get(key);
    if (entry && entry.resetAt > now) return entry;
    if (windows.size >= MAX_KEYS) makeRoom(now);
    const fresh = { count: 0, resetAt: now + windowMs };
    windows.set(key, fresh);
    return fresh;
};

// Counts one hit. { ok: false, retryAfterMs } once `limit` hits were made inside the window.
export const hit = (key, { limit, windowMs }) => {
    const now = Date.now();
    const entry = windowFor(key, windowMs, now);
    if (entry.count >= limit) return { ok: false, retryAfterMs: entry.resetAt - now };
    entry.count += 1;
    return { ok: true, retryAfterMs: 0 };
};

// Counts `count` more hits at once, never past `limit`, for a request that turned out to cost more
// than one try.
export const addHits = (key, { limit, windowMs }, count) => {
    const entry = windowFor(key, windowMs, Date.now());
    entry.count = Math.min(limit, entry.count + count);
};

// For tests.
export const resetRateLimits = () => windows.clear();
