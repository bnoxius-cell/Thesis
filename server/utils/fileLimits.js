// Every number that keeps file storage inside the free tiers (plan 18, sections 2 and 3.12).
// Env can lower the monthly caps but never raise them past the ceilings here, and a missing or
// invalid value falls back to the default: no setting ever means "unlimited".

const MIB = 1024 * 1024;
const TEN_MINUTES_MS = 10 * 60 * 1000;

export const MAX_LINK_TTL_SECONDS = 120;
export const MIN_LINK_TTL_SECONDS = 10;

const NUMBER_SETTINGS = {
    storageCapMb: { env: 'FILE_STORAGE_CAP_MB', fallback: 5000, max: 8000 },
    classAMonthlyCap: { env: 'FILE_CLASS_A_MONTHLY_CAP', fallback: 100_000, max: 400_000 },
    classBMonthlyCap: { env: 'FILE_CLASS_B_MONTHLY_CAP', fallback: 1_000_000, max: 1_500_000 },
    uploadMonthlyMb: { env: 'FILE_UPLOAD_MONTHLY_MB', fallback: 1000, max: 2000 },
    linkTtlSeconds: { env: 'FILE_LINK_TTL_SECONDS', fallback: 60, min: MIN_LINK_TTL_SECONDS, max: MAX_LINK_TTL_SECONDS },
};

// Not configurable: per-student limits and the reconciliation thresholds.
const FIXED_LIMITS = {
    userStorageBytes: 100 * MIB,
    maxFileBytes: 10 * MIB,
    maxThumbBytes: 100 * 1024,
    uploadBurst: { limit: 20, windowMs: TEN_MINUTES_MS },
    uploadsPerDay: 60,
    uploadBytesPerDay: 200 * MIB,
    linkBurst: { limit: 120, windowMs: TEN_MINUTES_MS },
    linksPerDay: 400,
    maxLinksPerRequest: 24,
    maxConcurrentUploads: 2,
    reconcileIntervalMs: TEN_MINUTES_MS,
    tripRealClassB: 2_500_000,
    tripRealClassA: 250_000,
    readGapFloor: 25_000,
    readGapRatio: 0.25,
    writeGapMargin: 5000,
    storageGapBytes: 500 * MIB,
    analyticsFailureLimit: 6,
};

const R2_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'CF_ANALYTICS_TOKEN'];

// Plain positive whole numbers only ("0x10" or "1e3" count as not set). Clamped into [min, max] with a warning.
const readNumber = (env, { env: name, fallback, min = 1, max }) => {
    const raw = env[name]?.trim() ?? '';
    const parsed = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
    const clamped = Math.min(Math.max(parsed, min), max);
    if (clamped !== parsed) console.warn(`[files] ${name} is outside ${min}..${max}; using ${clamped}`);
    return clamped;
};

// Real R2 only in production, with the switch exactly "true" and every key present. The in-memory
// store only in tests or with FILES_DEV_MEMORY exactly "true" (the UI harness, local dev), never
// in production. Anything else (a missing or mistyped NODE_ENV, staging) has files off.
const readAvailability = (env) => {
    if (env.NODE_ENV !== 'production') {
        const memory = env.NODE_ENV === 'test' || env.FILES_DEV_MEMORY === 'true';
        return memory ? { on: true, store: 'memory', reason: '' } : { on: false, store: null, reason: 'disabled' };
    }
    if (env.FILES_ENABLED !== 'true') return { on: false, store: null, reason: 'disabled' };
    if (R2_VARS.some((name) => !env[name]?.trim())) return { on: false, store: null, reason: 'not_configured' };
    return { on: true, store: 'r2', reason: '' };
};

const readFileLimits = () => {
    const env = process.env;
    const value = (key) => readNumber(env, NUMBER_SETTINGS[key]);
    return Object.freeze({
        ...FIXED_LIMITS,
        storageCapBytes: value('storageCapMb') * MIB,
        classAMonthlyCap: value('classAMonthlyCap'),
        classBMonthlyCap: value('classBMonthlyCap'),
        uploadMonthlyBytes: value('uploadMonthlyMb') * MIB,
        linkTtlSeconds: value('linkTtlSeconds'),
        alertEmail: env.FILES_ALERT_EMAIL?.trim() ?? '',
        // Verified accounts allowed to open the owner usage page (comma separated, any case).
        adminEmails: Object.freeze((env.FILES_ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)),
        availability: Object.freeze(readAvailability(env)),
    });
};

let limits = null;

export const getFileLimits = () => (limits ??= readFileLimits());

// Re-reads the env. Tests call this after changing process.env; the store is rebuilt on its next use.
export const reloadFileLimits = () => {
    limits = readFileLimits();
    return limits;
};

// For tests: the env limits with some values replaced (per-student numbers aren't env). Like
// reloadFileLimits, it drops the cached store.
export const setFileLimitsForTests = (overrides) => {
    limits = Object.freeze({ ...readFileLimits(), ...overrides });
    return limits;
};

// { on, store: 'memory' | 'r2' | null, reason }. `on: false` means uploads and links answer 503 files_off.
export const filesAvailability = () => getFileLimits().availability;
