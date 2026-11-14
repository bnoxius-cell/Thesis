// One-off: marks existing email + password accounts as having chosen their own password
// (`passwordSet`), which `hasPassword` now reads. Google sign-ups are left alone: the hash they
// store is random and they never saw it. Dry run by default; uses MONGO_URI from server/.env.
//
//   node scripts/backfillPasswordSet.js           prints the counts, changes nothing
//   node scripts/backfillPasswordSet.js --apply   writes
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import userModel from '../models/userModel.js';

const LOCAL_WITHOUT_FLAG = {
    authProvider: { $ne: 'google' },
    password: { $nin: ['', null] },
    passwordSet: { $ne: true },
};

export const backfillPasswordSet = async ({ apply = false } = {}) => {
    const matched = await userModel.countDocuments(LOCAL_WITHOUT_FLAG);
    const googleSkipped = await userModel.countDocuments({ authProvider: 'google', passwordSet: { $ne: true } });
    if (!apply) return { matched, googleSkipped, updated: 0 };

    const { modifiedCount } = await userModel.updateMany(LOCAL_WITHOUT_FLAG, { $set: { passwordSet: true } });
    return { matched, googleSkipped, updated: modifiedCount };
};

const runFromCommandLine = async () => {
    await import('dotenv/config');
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in server/.env.');
    }
    const apply = process.argv.includes('--apply');

    await mongoose.connect(process.env.MONGO_URI);
    try {
        const { matched, googleSkipped, updated } = await backfillPasswordSet({ apply });
        console.log(`Email accounts without passwordSet: ${matched}. Google sign-ups left alone: ${googleSkipped}.`);
        console.log(apply ? `Updated ${updated}.` : 'Dry run, nothing written. Run again with --apply to write.');
    } finally {
        await mongoose.disconnect();
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runFromCommandLine().catch((error) => {
        console.error('Backfill failed:', error.message);
        process.exitCode = 1;
    });
}
