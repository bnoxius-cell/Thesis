// The only file that talks to Cloudflare R2, and it can do exactly four things: PUT one object,
// DELETE one object, GET one object for a server-side read, and presign a GET (computed locally,
// no network: the browser does the GET). No listing, HEAD, multipart or copy calls, so every
// billed operation is one we reserved first.
import { AwsClient } from 'aws4fetch';
import { StoreError, assertAsciiHeaders, assertExpiresIn, assertMaxBytes, assertStoreKey } from './storeError.js';

const PUT_TIMEOUT_MS = 15_000;
const REMOVE_TIMEOUT_MS = 10_000;
const GET_TIMEOUT_MS = 20_000;

// Errors carry the short name, status and key only (never the URL, headers or signature).
const failure = (error, failName, key) => new StoreError(error?.name === 'TimeoutError' ? 'Timeout' : failName, { key });

// One HTTP attempt, no retries: a retry is a second billed operation we did not reserve.
const sendOnce = async (fetchImpl, request, { timeoutMs, key, failName }) => {
    try {
        return await fetchImpl(request, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
        throw failure(error, failName, key);
    }
};

// The response body as one buffer, never more than maxBytes: a declared length over it is refused
// without reading, and a body that outgrows it is cancelled mid-stream.
const readCapped = async (response, { maxBytes, key }) => {
    if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new StoreError('TooBig', { key });
    }
    if (!response.body) return Buffer.alloc(0);

    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        let chunk;
        try {
            chunk = await reader.read();
        } catch (error) {
            throw failure(error, 'GetFailed', key);
        }
        if (chunk.done) return Buffer.concat(chunks, total);
        total += chunk.value.length;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new StoreError('TooBig', { key });
        }
        chunks.push(chunk.value);
    }
};

export const createR2Store = ({ accountId, accessKeyId, secretAccessKey, bucket, fetchImpl = fetch }) => {
    const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto', retries: 0 });
    const objectUrl = (key) => new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);

    return {
        name: 'r2',

        async put(key, buffer, headers = {}) {
            assertStoreKey(key);
            assertAsciiHeaders(headers, key);
            const request = await client.sign(objectUrl(key).href, {
                method: 'PUT',
                body: buffer,
                headers: { ...headers, 'Content-Length': String(buffer.length) },
            });
            const response = await sendOnce(fetchImpl, request, { timeoutMs: PUT_TIMEOUT_MS, key, failName: 'PutFailed' });
            if (response.status !== 200) throw new StoreError('PutFailed', { key, status: response.status });
        },

        // Deleting something already gone (404) is fine; DeleteObject is free on R2.
        async remove(key) {
            assertStoreKey(key);
            const request = await client.sign(objectUrl(key).href, { method: 'DELETE' });
            const response = await sendOnce(fetchImpl, request, { timeoutMs: REMOVE_TIMEOUT_MS, key, failName: 'RemoveFailed' });
            if (response.status !== 204 && response.status !== 404) {
                throw new StoreError('RemoveFailed', { key, status: response.status });
            }
        },

        // One header-signed GET, not a presigned query, so presignGet stays the only query-signed URL.
        // 404 is Missing; any other non-200 is GetFailed.
        async get(key, { maxBytes }) {
            assertStoreKey(key);
            assertMaxBytes(maxBytes, key);
            const request = await client.sign(objectUrl(key).href, { method: 'GET' });
            const response = await sendOnce(fetchImpl, request, { timeoutMs: GET_TIMEOUT_MS, key, failName: 'GetFailed' });
            if (response.status !== 200) {
                await response.body?.cancel().catch(() => {});
                throw new StoreError(response.status === 404 ? 'Missing' : 'GetFailed', { key, status: response.status });
            }
            return readCapped(response, { maxBytes, key });
        },

        // The expiry is set before signing so it is part of the signature; a holder can't change it.
        async presignGet(key, { expiresIn }) {
            assertStoreKey(key);
            assertExpiresIn(expiresIn, key);
            const url = objectUrl(key);
            url.searchParams.set('X-Amz-Expires', String(expiresIn));
            const signed = await client.sign(url.href, { method: 'GET', aws: { signQuery: true } });
            return signed.url;
        },
    };
};
