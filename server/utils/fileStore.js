// Picks the file store for this process: memory outside production, R2 only when the kill switch
// and every key are in place (fileLimits.filesAvailability), otherwise none.
import { filesAvailability, getFileLimits } from './fileLimits.js';
import { createMemoryStore } from './fileStores/memoryStore.js';
import { createR2Store } from './fileStores/r2Store.js';

let cached = null; // { limits, store } — tied to the limits object, so reloadFileLimits() drops it

const buildStore = () => {
    const { store } = filesAvailability();
    if (store === 'memory') return createMemoryStore();
    if (store === 'r2') {
        return createR2Store({
            accountId: process.env.R2_ACCOUNT_ID,
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
            bucket: process.env.R2_BUCKET,
        });
    }
    return null;
};

// The store, created on first use, or null while files are off.
export const getFileStore = () => {
    const limits = getFileLimits();
    if (cached?.limits !== limits) cached = { limits, store: buildStore() };
    return cached.store;
};

// For tests: use `store` (or null for "files off") until the limits are reloaded.
export const setFileStoreForTests = (store) => {
    cached = { limits: getFileLimits(), store };
};
