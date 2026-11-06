import { describe, test, expect, vi } from 'vitest';
import { R2UsageError, classify, fetchR2Usage } from '../utils/r2Usage.js';

const TOKEN = 'cf-analytics-token-do-not-log';
const FROM = new Date('2026-11-01T00:00:00Z');
const TO = new Date('2026-11-15T10:00:00Z');

const reply = (body, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const usageBody = (operations, payloadSize = 0) => ({
    data: { viewer: { accounts: [{ operations, storage: [{ dimensions: { datetime: '2026-11-15T00:00:00Z' }, max: { payloadSize } }] }] } },
    errors: null,
});
const op = (actionType, requests, responseStatusCode) => ({ dimensions: { actionType, responseStatusCode }, sum: { requests } });

const run = (fetchImpl) => fetchR2Usage({ accountId: 'acc', token: TOKEN, bucket: 'stresscare-files', from: FROM, to: TO, fetchImpl });

// The failure a call rejects with, so tests can check its code and that it never carries the token.
const failure = (promise) => promise.then(() => null, (error) => error);

describe('classify', () => {
    test('maps action types to their billing class, unknown ones to Class A', () => {
        expect(['GetObject', 'HeadObject', 'HeadBucket', 'UsageSummary'].map(classify)).toEqual(['B', 'B', 'B', 'B']);
        expect(['PutObject', 'ListObjects', 'CopyObject', 'SomethingNew', undefined].map(classify)).toEqual(['A', 'A', 'A', 'A', 'A']);
        expect(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload'].map(classify)).toEqual([null, null, null]);
    });
});

describe('fetchR2Usage', () => {
    test('sends one POST to the GraphQL API with the bearer token, the bucket and the range', async () => {
        const fetchImpl = reply(usageBody([]));
        await run(fetchImpl);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
        expect(init.signal).toBeInstanceOf(AbortSignal);
        const { query, variables } = JSON.parse(init.body);
        expect(variables).toEqual({ accountTag: 'acc', bucket: 'stresscare-files', from: '2026-11-01T00:00:00.000Z', to: TO.toISOString() });
        expect(query).toContain('r2OperationsAdaptiveGroups(limit: 10000');
        expect(query).toContain('datetime_geq: $from, datetime_leq: $to, bucketName: $bucket');
        expect(query).toContain('dimensions { actionType responseStatusCode }');
        expect(query).toContain('r2StorageAdaptiveGroups');
        expect(query).not.toContain('objectName');
    });

    test('adds requests up by class and ignores the free ones', async () => {
        const fetchImpl = reply(usageBody([
            op('GetObject', 900), op('HeadObject', 100), op('PutObject', 40), op('SomethingNew', 2), op('DeleteObject', 500),
        ], 123_456));
        expect(await run(fetchImpl)).toEqual({ classA: 42, classB: 1000, storageBytes: 123_456 });
    });

    test('failed-auth groups (401, 403) are not billed and left out; every other status counts', async () => {
        const fetchImpl = reply(usageBody([
            op('GetObject', 25_000, 403), op('GetObject', 900, 401), op('PutObject', 7, 403),
            op('GetObject', 10, 200), op('GetObject', 3, 404), op('GetObject', 2), op('PutObject', 4, 500),
        ]));
        expect(await run(fetchImpl)).toEqual({ classA: 4, classB: 15, storageBytes: 0 });
    });

    test('a bucket with no data yet reads as zero', async () => {
        const fetchImpl = reply({ data: { viewer: { accounts: [{ operations: [], storage: [] }] } } });
        expect(await run(fetchImpl)).toEqual({ classA: 0, classB: 0, storageBytes: 0 });
    });

    test.each([
        ['an HTTP error', reply({ errors: [{ message: 'nope' }] }, 403), 'status_403'],
        ['an HTTP 200 with GraphQL errors', reply({ data: null, errors: [{ message: `bad token ${TOKEN}` }] }), 'graphql_errors'],
        ['no account in the answer', reply({ data: { viewer: { accounts: [] } } }), 'no_data'],
        ['a body that is not JSON', vi.fn(async () => new Response('<html>', { status: 200 })), 'bad_json'],
        ['a network error', vi.fn(async () => { throw new Error(`connect failed Bearer ${TOKEN}`); }), 'network'],
    ])('%s fails with a short code and no token', async (_name, fetchImpl, code) => {
        const error = await failure(run(fetchImpl));
        expect(error).toBeInstanceOf(R2UsageError);
        expect(error.code).toBe(code);
        expect(`${error.message} ${error.stack}`).not.toContain(TOKEN);
    });

    test('a timeout fails as timeout', async () => {
        const fetchImpl = vi.fn(async () => { throw new DOMException('The operation timed out.', 'TimeoutError'); });
        expect((await failure(run(fetchImpl))).code).toBe('timeout');
    });
});
