// Reads R2's own operation counts and stored bytes from Cloudflare's GraphQL Analytics API
// (plan 18, 3.14), so the reconciliation can see reads we never counted (a replayed or shared
// link) and writes we never made (a leaked key). Read-only, and costs no R2 operations.
// The token is a bearer secret: it goes in the Authorization header and nowhere else, and errors
// from here carry a short code only, never the request, the response body or the token.

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const TIMEOUT_MS = 10_000;

// Cloudflare's billing classes (plan 18, P3). Anything not listed counts as Class A, the dearer
// one, so a new action type (or a bucket config read we didn't name) can only make us stricter.
// These are names in Cloudflare's numbers; this file never calls R2 (the guard test checks).
const CLASS_B = new Set(['HeadBucket', 'HeadObject', 'GetObject', 'UsageSummary']);
const FREE = new Set(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload']);

// 'A', 'B', or null for the free ones.
export const classify = (actionType) => {
    if (FREE.has(actionType)) return null;
    return CLASS_B.has(actionType) ? 'B' : 'A';
};

// Every status counts: Cloudflare already leaves failed-auth requests out of its numbers, and
// counting the rest only makes us stricter. Storage is the newest day's peak.
const QUERY = `query R2Usage($accountTag: string!, $bucket: string!, $from: Time!, $to: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      operations: r2OperationsAdaptiveGroups(limit: 10000, filter: { datetime_geq: $from, datetime_leq: $to, bucketName: $bucket }) {
        dimensions { actionType }
        sum { requests }
      }
      storage: r2StorageAdaptiveGroups(limit: 1, orderBy: [datetime_DESC], filter: { datetime_geq: $from, datetime_leq: $to, bucketName: $bucket }) {
        dimensions { datetime }
        max { payloadSize }
      }
    }
  }
}`;

export class R2UsageError extends Error {
    constructor(code) {
        super(`usage check failed: ${code}`);
        this.name = 'R2UsageError';
        this.code = code;
    }
}

const count = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

// Adds up one account's groups into { classA, classB, storageBytes }.
const totals = ({ operations, storage }) => {
    const result = { classA: 0, classB: 0, storageBytes: count(storage?.[0]?.max?.payloadSize) };
    for (const group of operations) {
        const billed = classify(group?.dimensions?.actionType);
        if (billed === 'A') result.classA += count(group?.sum?.requests);
        if (billed === 'B') result.classB += count(group?.sum?.requests);
    }
    return result;
};

// One request for [from, to] (at most 31 days, so callers start at the 1st of the UTC month).
// Throws R2UsageError on any failure, including an HTTP 200 that carries GraphQL errors.
export const fetchR2Usage = async ({ accountId, token, bucket, from, to, fetchImpl = fetch }) => {
    let response;
    try {
        response = await fetchImpl(GRAPHQL_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: QUERY,
                variables: { accountTag: accountId, bucket, from: from.toISOString(), to: to.toISOString() },
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (error) {
        throw new R2UsageError(error?.name === 'TimeoutError' ? 'timeout' : 'network');
    }
    if (response.status !== 200) throw new R2UsageError(`status_${response.status}`);

    let body;
    try {
        body = await response.json();
    } catch {
        throw new R2UsageError('bad_json');
    }
    if (body?.errors?.length) throw new R2UsageError('graphql_errors');
    const account = body?.data?.viewer?.accounts?.[0];
    if (!Array.isArray(account?.operations)) throw new R2UsageError('no_data');
    return totals(account);
};
