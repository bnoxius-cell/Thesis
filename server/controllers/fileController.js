import fileModel from '../models/fileModel.js';
import fileUsageModel from '../models/fileUsageModel.js';
import userModel from '../models/userModel.js';
import { STORAGE_ID, monthId, nextMonthStart } from '../utils/fileBudget.js';
import { filesAvailability, getFileLimits } from '../utils/fileLimits.js';
import { getFileStore } from '../utils/fileStore.js';
import { serverError } from '../utils/httpErrors.js';

const percentOf = (used, cap) => Math.round((used / cap) * 100);

// What the owner sees on the usage page (plan 18, 3.11). Counters and ledger totals only, read from
// MongoDB: no object keys, no links, nothing from the store.
const usageSnapshot = async (now) => {
    const limits = getFileLimits();
    const [storage, month, ledger, rowsRemoving] = await Promise.all([
        fileUsageModel.findById(STORAGE_ID).lean(),
        fileUsageModel.findById(monthId(now)).lean(),
        fileModel.aggregate([{ $group: { _id: null, bytes: { $sum: '$bytes' } } }]),
        fileModel.countDocuments({ state: 'removing' }),
    ]);
    const used = {
        storageBytes: storage?.bytes ?? 0,
        classA: month?.classA ?? 0,
        classB: month?.classB ?? 0,
        uploadBytes: month?.uploadBytes ?? 0,
    };
    const caps = {
        storageBytes: limits.storageCapBytes,
        classA: limits.classAMonthlyCap,
        classB: limits.classBMonthlyCap,
        uploadBytes: limits.uploadMonthlyBytes,
    };
    const real = month?.real ?? {};
    const ledgerBytes = ledger[0]?.bytes ?? 0;
    const { on, store } = filesAvailability();

    return {
        enabled: on,
        store,
        month: monthId(now).slice('month:'.length),
        caps,
        used,
        real: { classA: real.classA ?? 0, classB: real.classB ?? 0, storageBytes: real.storageBytes ?? 0, checkedAt: real.checkedAt ?? null },
        tripped: { reads: month?.tripped?.reads ?? '', writes: month?.tripped?.writes ?? '' },
        // True once Cloudflare's numbers have been read and the latest read worked.
        analyticsOk: Boolean(real.checkedAt) && (month?.analyticsFailures ?? 0) === 0,
        percent: Object.fromEntries(Object.keys(caps).map((name) => [name, percentOf(used[name], caps[name])])),
        ledgerBytes,
        // Counter minus ledger: above 0 means the counter is high, which is the safe side.
        drift: used.storageBytes - ledgerBytes,
        rowsRemoving,
        resumesAt: nextMonthStart(now),
    };
};

// Owner only: verified accounts listed in FILES_ADMIN_EMAILS. Everyone else gets the same 404 as a
// route that doesn't exist.
export const getUsage = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select('email isAccountVerified').lean();
        const isOwner = user?.isAccountVerified && getFileLimits().adminEmails.includes(user.email.trim().toLowerCase());
        if (!isOwner) return res.status(404).json({ success: false, message: 'Not found.' });
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, ...(await usageSnapshot(new Date())) });
    } catch (error) {
        serverError(res, 'Reading file usage failed', error);
    }
};

// Dev only (the route exists only with the in-memory store): serves a stored object the way R2
// would, with the headers it was stored with, and 403 once the link has expired or was altered.
export const getDevFile = (req, res) => {
    const store = getFileStore();
    if (!store?.openDevLink) return res.status(404).json({ success: false, message: 'File not found.' });
    const { object, reason } = store.openDevLink(req.params.token);
    if (reason === 'gone') return res.status(404).json({ success: false, message: 'File not found.' });
    if (reason) return res.status(403).json({ success: false, message: 'This link has expired or is not valid.' });
    res.status(200).set({ ...object.headers, 'X-Content-Type-Options': 'nosniff' }).end(object.buffer);
};
