// What the file stores throw and check. The error carries a short name, the status and the key,
// and never a URL, header or signature, so it is safe to log.

export class StoreError extends Error {
    constructor(name, { key, status = 0 }) {
        super(`${name} ${key}${status ? ` (status ${status})` : ''}`);
        this.name = name;
        this.key = key;
        this.status = status;
    }
}

// Server-made object keys only: "f/<uuid>" for a file, "t/<uuid>" for its thumbnail.
const STORE_KEY = /^[ft]\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const assertStoreKey = (key) => {
    if (typeof key !== 'string' || !STORE_KEY.test(key)) throw new StoreError('BadKey', { key: 'invalid' });
};

// Object headers become request headers on R2, and a non-ASCII value makes fetch throw.
export const assertAsciiHeaders = (headers, key) => {
    for (const value of Object.values(headers)) {
        if (typeof value !== 'string' || !/^[\x20-\x7e]*$/.test(value)) {
            throw new StoreError('BadHeader', { key });
        }
    }
};
