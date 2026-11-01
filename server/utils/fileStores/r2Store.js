// The only file that talks to Cloudflare R2, and it can do exactly three things: PUT one object,
// DELETE one object, and presign a GET (computed locally, no network: the browser does the GET).
// No listing, HEAD, multipart or copy calls, so every billed operation is one we reserved first.
import { AwsClient } from 'aws4fetch';
import { MAX_LINK_TTL_SECONDS } from '../fileLimits.js';
import { StoreError, assertAsciiHeaders, assertStoreKey } from './storeError.js';

const PUT_TIMEOUT_MS = 15_000;
const REMOVE_TIMEOUT_MS = 10_000;

// One HTTP attempt, no retries: a retry is a second billed operation we did not reserve.
// Errors carry the short name, status and key only (never the URL, headers or signature).
const sendOnce = async (fetchImpl, request, { timeoutMs, key, failName }) => {
    let response;
    try {
        response = await fetchImpl(request, { signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
        throw new StoreError(error?.name === 'TimeoutError' ? 'Timeout' : failName, { key });
    }
    return response;
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

        // The expiry is set before signing so it is part of the signature; a holder can't change it.
        async presignGet(key, { expiresIn }) {
            assertStoreKey(key);
            if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_LINK_TTL_SECONDS) {
                throw new StoreError('BadExpiry', { key });
            }
            const url = objectUrl(key);
            url.searchParams.set('X-Amz-Expires', String(expiresIn));
            const signed = await client.sign(url.href, { method: 'GET', aws: { signQuery: true } });
            return signed.url;
        },
    };
};
