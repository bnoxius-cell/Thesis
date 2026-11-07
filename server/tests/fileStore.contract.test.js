import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createMemoryStore, DEV_LINK_PREFIX } from '../utils/fileStores/memoryStore.js';
import { createR2Store } from '../utils/fileStores/r2Store.js';
import { StoreError } from '../utils/fileStores/storeError.js';
import { getFileStore, setFileStoreForTests } from '../utils/fileStore.js';
import { reloadFileLimits } from '../utils/fileLimits.js';

const SECRET = 'fake-secret-access-key';
const HEADERS = {
    'Content-Type': 'image/png',
    'Content-Disposition': 'inline; filename="photo.png"; filename*=UTF-8\'\'photo.png',
    'Cache-Control': 'private, max-age=86400, immutable',
};
const newKey = (prefix = 'f') => `${prefix}/${randomUUID()}`;
const bytes = (text) => Buffer.from(text);

// A fake fetch that answers like R2 and remembers every request it was given.
const makeFakeFetch = (statusFor = (method) => (method === 'PUT' ? 200 : 204)) => {
    const requests = [];
    const fetchImpl = vi.fn(async (request) => {
        requests.push({ method: request.method, url: request.url, headers: request.headers });
        return new Response(null, { status: statusFor(request.method) });
    });
    return { fetchImpl, requests };
};

// A fake bucket: remembers what was PUT, serves it back on GET (404 when absent), and records requests.
const makeBucketFetch = () => {
    const objects = new Map();
    const requests = [];
    const fetchImpl = vi.fn(async (request) => {
        requests.push({ method: request.method, url: request.url, headers: request.headers });
        if (request.method === 'PUT') {
            objects.set(request.url, Buffer.from(await request.arrayBuffer()));
            return new Response(null, { status: 200 });
        }
        if (request.method === 'DELETE') {
            objects.delete(request.url);
            return new Response(null, { status: 204 });
        }
        const body = objects.get(request.url);
        return body
            ? new Response(body, { status: 200, headers: { 'content-length': String(body.length) } })
            : new Response(null, { status: 404 });
    });
    return { fetchImpl, requests };
};

// A response body that only reads (pulls) when asked, so a test can see whether anything was read.
const lazyStream = (chunks, stats) => {
    let next = 0;
    return new ReadableStream({
        pull(controller) {
            stats.pulls += 1;
            if (next < chunks.length) controller.enqueue(chunks[next++]);
            else controller.close();
        },
        cancel() { stats.cancelled = true; },
    }, { highWaterMark: 0 });
};

const makeR2 = (fetchImpl) => createR2Store({
    accountId: 'acc',
    accessKeyId: 'fake-key-id',
    secretAccessKey: SECRET,
    bucket: 'bucket',
    fetchImpl,
});

describe.each([
    ['memory', () => createMemoryStore()],
    ['r2', () => makeR2(makeBucketFetch().fetchImpl)],
])('%s store contract', (name, make) => {
    test('get returns the put bytes, and a copy each time', async () => {
        const store = make();
        const key = newKey();
        await store.put(key, bytes('hello'), HEADERS);
        const first = await store.get(key, { maxBytes: 5 });
        expect(first.toString()).toBe('hello');
        first.fill(0);
        expect((await store.get(key, { maxBytes: 100 })).toString()).toBe('hello');
    });

    test('get of an absent object is Missing, and an object over maxBytes is TooBig', async () => {
        const store = make();
        const key = newKey();
        await expect(store.get(key, { maxBytes: 10 })).rejects.toMatchObject({ name: 'Missing', key, status: 404 });
        await store.put(key, bytes('hello'), HEADERS);
        await expect(store.get(key, { maxBytes: 4 })).rejects.toMatchObject({ name: 'TooBig', key });
    });

    test.each([-1, 1.5, '5', undefined, Infinity])('get with a limit of %j is refused', async (maxBytes) => {
        await expect(make().get(newKey(), { maxBytes })).rejects.toMatchObject({ name: 'BadLimit' });
    });

    test('put, presign, remove and a second remove all succeed', async () => {
        const store = make();
        const key = newKey();
        await store.put(key, bytes('hello'), HEADERS);
        const url = await store.presignGet(key, { expiresIn: 60 });
        expect(typeof url).toBe('string');
        await store.remove(key);
        await store.remove(key);
    });

    test.each([0, -1, 9, 1.5, 121, 604800, '60', undefined])('a lifetime of %j is refused', async (expiresIn) => {
        await expect(make().presignGet(newKey(), { expiresIn })).rejects.toMatchObject({ name: 'BadExpiry' });
    });

    test('keys that are not server-made are refused', async () => {
        const store = make();
        for (const key of ['f/../x', 'f/abc', `x/${randomUUID()}`, `f/${randomUUID()}?a=b`, undefined]) {
            await expect(store.put(key, bytes('x'), HEADERS)).rejects.toMatchObject({ name: 'BadKey' });
            await expect(store.remove(key)).rejects.toMatchObject({ name: 'BadKey' });
            await expect(store.get(key, { maxBytes: 10 })).rejects.toMatchObject({ name: 'BadKey' });
            await expect(store.presignGet(key, { expiresIn: 60 })).rejects.toMatchObject({ name: 'BadKey' });
        }
    });

    test('a header with non-ASCII text or a line break is refused', async () => {
        const store = make();
        await expect(store.put(newKey(), bytes('x'), { 'Content-Disposition': 'inline; filename="ภาพ.png"' }))
            .rejects.toMatchObject({ name: 'BadHeader' });
        await expect(store.put(newKey(), bytes('x'), { 'Content-Type': 'text/plain\r\nSet-Cookie: a=b' }))
            .rejects.toMatchObject({ name: 'BadHeader' });
    });
});

describe('memory store', () => {
    let store;
    const key = newKey();
    beforeEach(async () => {
        store = createMemoryStore();
        await store.put(key, bytes('hello'), HEADERS);
    });

    test('a link opens before it expires and hands back the bytes and the stored headers', async () => {
        const now = Date.now();
        const url = await store.presignGet(key, { expiresIn: 60, now });
        expect(url.startsWith(DEV_LINK_PREFIX)).toBe(true);
        const opened = store.openDevLink(url.slice(DEV_LINK_PREFIX.length), now + 59_000);
        expect(opened.object.buffer.toString()).toBe('hello');
        expect(opened.object.headers).toEqual({
            'content-type': HEADERS['Content-Type'],
            'content-disposition': HEADERS['Content-Disposition'],
            'cache-control': HEADERS['Cache-Control'],
        });
    });

    test('a link is expired one second after its lifetime', async () => {
        const now = Date.now();
        const token = (await store.presignGet(key, { expiresIn: 60, now })).slice(DEV_LINK_PREFIX.length);
        expect(store.openDevLink(token, now + 60_000).object).toBeDefined();
        expect(store.openDevLink(token, now + 61_000)).toEqual({ reason: 'expired' });
    });

    test('changing any character of the token makes it bad', async () => {
        const token = (await store.presignGet(key, { expiresIn: 60 })).slice(DEV_LINK_PREFIX.length);
        for (const index of [0, 5, token.indexOf('.') + 1, token.length - 1]) {
            const swapped = token[index] === 'A' ? 'B' : 'A';
            const tampered = token.slice(0, index) + swapped + token.slice(index + 1);
            expect(store.openDevLink(tampered)).toEqual({ reason: 'bad' });
        }
        for (const junk of ['', 'abc', 'a.b.c', undefined]) {
            expect(store.openDevLink(junk)).toEqual({ reason: 'bad' });
        }
    });

    test('a token from another store instance is bad', async () => {
        const token = (await store.presignGet(key, { expiresIn: 60 })).slice(DEV_LINK_PREFIX.length);
        expect(createMemoryStore().openDevLink(token)).toEqual({ reason: 'bad' });
    });

    test('a link to a removed object says gone', async () => {
        const token = (await store.presignGet(key, { expiresIn: 60 })).slice(DEV_LINK_PREFIX.length);
        await store.remove(key);
        expect(store.openDevLink(token)).toEqual({ reason: 'gone' });
        expect(store.size()).toBe(0);
    });

    test('a replayed link keeps working and is counted by devReads', async () => {
        const token = (await store.presignGet(key, { expiresIn: 60 })).slice(DEV_LINK_PREFIX.length);
        for (let i = 0; i < 3; i += 1) expect(store.openDevLink(token).object).toBeDefined();
        expect(store.devReads(key)).toBe(3);
    });

    test('failNext fails exactly one get', async () => {
        store.failNext('get');
        await expect(store.get(key, { maxBytes: 10 })).rejects.toBeInstanceOf(StoreError);
        expect((await store.get(key, { maxBytes: 10 })).toString()).toBe('hello');
    });

    test('failNext fails exactly one put or remove', async () => {
        store.failNext('put');
        await expect(store.put(newKey(), bytes('x'), HEADERS)).rejects.toBeInstanceOf(StoreError);
        await store.put(newKey(), bytes('x'), HEADERS);
        store.failNext('remove');
        await expect(store.remove(key)).rejects.toBeInstanceOf(StoreError);
        await store.remove(key);
        expect(store.size()).toBe(1);
    });

    test('stored bytes are a copy and reset empties the store', async () => {
        const source = bytes('abc');
        const other = newKey('t');
        await store.put(other, source, HEADERS);
        source.fill(0);
        const token = (await store.presignGet(other, { expiresIn: 60 })).slice(DEV_LINK_PREFIX.length);
        expect(store.openDevLink(token).object.buffer.toString()).toBe('abc');
        store.reset();
        expect(store.keys()).toEqual([]);
        expect(store.devReads(key)).toBe(0);
    });
});

describe('r2 store requests', () => {
    test('put sends exactly one PUT with the given headers, signed, and no storage class', async () => {
        const { fetchImpl, requests } = makeFakeFetch();
        const key = newKey();
        await makeR2(fetchImpl).put(key, bytes('hello'), HEADERS);

        expect(requests).toHaveLength(1);
        const [request] = requests;
        expect(request.method).toBe('PUT');
        expect(request.url).toBe(`https://acc.r2.cloudflarestorage.com/bucket/${key}`);
        expect(request.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
        expect(request.headers.get('content-type')).toBe(HEADERS['Content-Type']);
        expect(request.headers.get('content-disposition')).toBe(HEADERS['Content-Disposition']);
        expect(request.headers.get('cache-control')).toBe(HEADERS['Cache-Control']);
        expect(request.headers.get('content-length')).toBe('5');
        expect([...request.headers.keys()].some((header) => header.startsWith('x-amz-storage-class'))).toBe(false);
    });

    test('remove sends exactly one DELETE and treats 404 as done', async () => {
        const { fetchImpl, requests } = makeFakeFetch(() => 404);
        const key = newKey('t');
        await makeR2(fetchImpl).remove(key);
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe('DELETE');
        expect(requests[0].url).toBe(`https://acc.r2.cloudflarestorage.com/bucket/${key}`);
        expect(requests[0].headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
    });

    test('a 500 on put makes exactly one request and throws a StoreError with no URL or secret in it', async () => {
        const { fetchImpl, requests } = makeFakeFetch(() => 500);
        const key = newKey();
        const error = await makeR2(fetchImpl).put(key, bytes('x'), HEADERS).catch((caught) => caught);

        expect(requests).toHaveLength(1);
        expect(error).toBeInstanceOf(StoreError);
        expect(error).toMatchObject({ name: 'PutFailed', status: 500, key });
        expect(error.message).not.toMatch(/https?:|Signature|Credential|fake-/i);
        expect(JSON.stringify(error)).not.toContain(SECRET);
    });

    test('a 500 on remove throws', async () => {
        const { fetchImpl, requests } = makeFakeFetch(() => 500);
        await expect(makeR2(fetchImpl).remove(newKey())).rejects.toMatchObject({ name: 'RemoveFailed', status: 500 });
        expect(requests).toHaveLength(1);
    });

    test('a network failure and a timeout become StoreErrors without the cause', async () => {
        const broken = vi.fn(async () => { throw new TypeError('fetch failed: https://acc.r2.cloudflarestorage.com/?X-Amz-Signature=abc'); });
        const failure = await makeR2(broken).put(newKey(), bytes('x'), HEADERS).catch((caught) => caught);
        expect(failure).toMatchObject({ name: 'PutFailed', status: 0 });
        expect(failure.message).not.toContain('Signature');
        expect(broken).toHaveBeenCalledTimes(1);

        const slow = vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); });
        await expect(makeR2(slow).remove(newKey())).rejects.toMatchObject({ name: 'Timeout' });
    });

    test('a refused key or header sends nothing', async () => {
        const { fetchImpl } = makeFakeFetch();
        const store = makeR2(fetchImpl);
        await expect(store.put('f/bad', bytes('x'), HEADERS)).rejects.toMatchObject({ name: 'BadKey' });
        await expect(store.put(newKey(), bytes('x'), { 'Content-Type': 'ภาพ' })).rejects.toMatchObject({ name: 'BadHeader' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('r2 get', () => {
    test('sends exactly one signed GET with the signature in a header, not in the URL', async () => {
        const { fetchImpl, requests } = makeBucketFetch();
        const store = makeR2(fetchImpl);
        const key = newKey();
        await store.put(key, bytes('hello'), HEADERS);
        requests.length = 0;

        expect((await store.get(key, { maxBytes: 5 })).toString()).toBe('hello');
        expect(requests).toHaveLength(1);
        const [request] = requests;
        expect(request.method).toBe('GET');
        expect(request.url).toBe(`https://acc.r2.cloudflarestorage.com/bucket/${key}`);
        expect(request.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
        expect(request.url).not.toContain('X-Amz-Signature');
    });

    test('a 404 is Missing and any other status is GetFailed, with one request and no secrets', async () => {
        const key = newKey();
        const missing = makeFakeFetch(() => 404);
        await expect(makeR2(missing.fetchImpl).get(key, { maxBytes: 5 })).rejects.toMatchObject({ name: 'Missing', status: 404, key });
        expect(missing.requests).toHaveLength(1);

        const broken = makeFakeFetch(() => 500);
        const error = await makeR2(broken.fetchImpl).get(key, { maxBytes: 5 }).catch((caught) => caught);
        expect(error).toBeInstanceOf(StoreError);
        expect(error).toMatchObject({ name: 'GetFailed', status: 500, key });
        expect(error.message).not.toMatch(/https?:|Signature|Credential|fake-/i);
        expect(broken.requests).toHaveLength(1);
    });

    test('a Content-Length over the limit is TooBig and the body is never read', async () => {
        const stats = { pulls: 0, cancelled: false };
        const fetchImpl = vi.fn(async () => new Response(lazyStream([bytes('hello')], stats), {
            status: 200,
            headers: { 'content-length': '5' },
        }));
        await expect(makeR2(fetchImpl).get(newKey(), { maxBytes: 4 })).rejects.toMatchObject({ name: 'TooBig' });
        expect(stats).toEqual({ pulls: 0, cancelled: true });
    });

    test('a body without a length that outgrows the limit is TooBig and the stream is cancelled', async () => {
        const stats = { pulls: 0, cancelled: false };
        const fetchImpl = vi.fn(async () => new Response(lazyStream([bytes('abc'), bytes('def'), bytes('ghi')], stats), { status: 200 }));
        await expect(makeR2(fetchImpl).get(newKey(), { maxBytes: 4 })).rejects.toMatchObject({ name: 'TooBig' });
        expect(stats).toEqual({ pulls: 2, cancelled: true });
    });

    test('a chunked body within the limit is joined in order', async () => {
        const stats = { pulls: 0, cancelled: false };
        const fetchImpl = vi.fn(async () => new Response(lazyStream([bytes('abc'), bytes('de')], stats), { status: 200 }));
        expect((await makeR2(fetchImpl).get(newKey(), { maxBytes: 5 })).toString()).toBe('abcde');
    });

    test('an empty object is an empty buffer', async () => {
        const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
        expect(await makeR2(fetchImpl).get(newKey(), { maxBytes: 5 })).toHaveLength(0);
    });

    test('a timeout while waiting or while reading the body is Timeout, other failures GetFailed', async () => {
        const slow = vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); });
        await expect(makeR2(slow).get(newKey(), { maxBytes: 5 })).rejects.toMatchObject({ name: 'Timeout' });

        const stalls = vi.fn(async () => new Response(new ReadableStream({
            pull() { throw new DOMException('timed out', 'TimeoutError'); },
        }, { highWaterMark: 0 }), { status: 200 }));
        await expect(makeR2(stalls).get(newKey(), { maxBytes: 5 })).rejects.toMatchObject({ name: 'Timeout' });

        const dropped = vi.fn(async () => { throw new TypeError('fetch failed: https://acc.r2.cloudflarestorage.com/?X-Amz-Signature=abc'); });
        const error = await makeR2(dropped).get(newKey(), { maxBytes: 5 }).catch((caught) => caught);
        expect(error).toMatchObject({ name: 'GetFailed', status: 0 });
        expect(error.message).not.toContain('Signature');
        expect(dropped).toHaveBeenCalledTimes(1);
    });

    test('a refused key or limit sends nothing', async () => {
        const { fetchImpl } = makeBucketFetch();
        const store = makeR2(fetchImpl);
        await expect(store.get('f/bad', { maxBytes: 5 })).rejects.toMatchObject({ name: 'BadKey' });
        await expect(store.get(newKey(), { maxBytes: -1 })).rejects.toMatchObject({ name: 'BadLimit' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('r2 presigned links', () => {
    test('presignGet makes no network call and returns a signed URL that expires in the asked time', async () => {
        const { fetchImpl } = makeFakeFetch();
        const key = newKey();
        const link = new URL(await makeR2(fetchImpl).presignGet(key, { expiresIn: 60 }));

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(link.origin).toBe('https://acc.r2.cloudflarestorage.com');
        expect(link.pathname).toBe(`/bucket/${key}`);
        expect(link.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
        expect(link.searchParams.get('X-Amz-Expires')).toBe('60');
        expect(link.searchParams.get('X-Amz-Date')).toMatch(/^\d{8}T\d{6}Z$/);
        expect(link.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
        expect(link.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
        expect([...link.searchParams.keys()].some((param) => param.startsWith('response-'))).toBe(false);
        expect(link.href).not.toContain(SECRET);
    });

    test('the lifetime is part of the signature', async () => {
        const store = makeR2(makeFakeFetch().fetchImpl);
        const key = newKey();
        const short = new URL(await store.presignGet(key, { expiresIn: 30 }));
        const long = new URL(await store.presignGet(key, { expiresIn: 120 }));
        expect(short.searchParams.get('X-Amz-Expires')).toBe('30');
        expect(long.searchParams.get('X-Amz-Expires')).toBe('120');
    });

});

describe('getFileStore', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        reloadFileLimits();
    });

    test('is the memory store outside production and is created once', () => {
        reloadFileLimits();
        const store = getFileStore();
        expect(store.name).toBe('memory');
        expect(getFileStore()).toBe(store);
    });

    test('reloadFileLimits drops the cached store', () => {
        const first = getFileStore();
        reloadFileLimits();
        expect(getFileStore()).not.toBe(first);
    });

    test('is null in production while files are off, and R2 only when everything is set', () => {
        vi.stubEnv('NODE_ENV', 'production');
        reloadFileLimits();
        expect(getFileStore()).toBeNull();

        vi.stubEnv('FILES_ENABLED', 'true');
        for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'CF_ANALYTICS_TOKEN']) {
            vi.stubEnv(name, `fake-${name}`);
        }
        reloadFileLimits();
        expect(getFileStore().name).toBe('r2');
    });

    test('setFileStoreForTests swaps the store until the limits are reloaded', () => {
        const fake = createMemoryStore();
        setFileStoreForTests(fake);
        expect(getFileStore()).toBe(fake);
        setFileStoreForTests(null);
        expect(getFileStore()).toBeNull();
        reloadFileLimits();
        expect(getFileStore().name).toBe('memory');
    });
});
