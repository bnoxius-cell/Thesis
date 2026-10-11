import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startFakeGemini, GEMINI_ERRORS } from './helpers/fakeGemini.js';
import { generateJson, geminiSettings, isGeminiConfigured, DEFAULT_GEMINI_MODEL } from '../utils/gemini.js';
import { friendlyError, isRetryable, isSetupProblem, isTimeout, withRetries, describeError } from '../utils/aiErrors.js';
import { REVIEWER_SCHEMA, REVIEWER_SYSTEM } from '../utils/reviewerContent.js';

// utils/gemini.js and the real SDK, talking HTTP to a fake Gemini on localhost.

let gemini;
const saved = {};
const KEYS = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GOOGLE_GEMINI_BASE_URL'];

beforeAll(async () => {
    gemini = await startFakeGemini();
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.GOOGLE_GEMINI_BASE_URL = gemini.url;
});
afterAll(async () => {
    for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
    await gemini.close();
});
beforeEach(() => {
    gemini.reset();
    process.env.GEMINI_API_KEY = 'test-key';
    delete process.env.GEMINI_MODEL;
    geminiSettings.timeoutMs = 100000;
});

const ask = () => generateJson({ system: REVIEWER_SYSTEM, prompt: 'Make a reviewer.', schema: REVIEWER_SCHEMA });
const failure = (promise) => promise.then(() => { throw new Error('expected a failure'); }, (error) => error);

describe('a request', () => {
    test('sends the prompt, system text, JSON schema and timeout, with the key in a header', async () => {
        gemini.reply(() => ({ json: { summary: 'Cells.' } }));
        const out = await ask();
        expect(out).toEqual({ data: { summary: 'Cells.' }, model: 'gemini-fake-001' });

        const [req] = gemini.requests;
        expect(req.model).toBe(DEFAULT_GEMINI_MODEL);
        expect(req.prompt).toBe('Make a reviewer.');
        expect(req.body.systemInstruction.parts[0].text).toBe(REVIEWER_SYSTEM);
        expect(req.body.generationConfig).toMatchObject({ responseMimeType: 'application/json', temperature: 0.4 });
        expect(req.body.generationConfig.responseJsonSchema).toEqual(REVIEWER_SCHEMA);
        // The key goes in a header, never in the URL (where proxies and logs would keep it).
        expect(req.apiKey).toBe('test-key');
        expect(req.url).not.toContain('test-key');
    });

    test('uses GEMINI_MODEL when it is set', async () => {
        process.env.GEMINI_MODEL = 'gemini-3.5-flash';
        await ask();
        expect(gemini.requests[0].model).toBe('gemini-3.5-flash');
    });

    test('a missing key fails before anything is sent', async () => {
        delete process.env.GEMINI_API_KEY;
        expect(isGeminiConfigured()).toBe(false);
        await expect(ask()).rejects.toThrow(/GEMINI_API_KEY is not set/);
        expect(gemini.requests).toHaveLength(0);
    });
});

describe('answers that cannot be used', () => {
    test('an empty answer (for example a blocked one) is unusable, so it gets asked again', async () => {
        gemini.reply(() => ({ text: undefined, finishReason: 'SAFETY' }));
        const error = await failure(ask());
        expect(error.code).toBe('invalid_output');
        expect(error.message).toMatch(/empty response \(SAFETY\)/);
        expect(isRetryable(error)).toBe(true);
    });

    test('an answer cut off mid-way is not valid JSON, and is unusable too', async () => {
        gemini.reply(() => ({ text: '{"summary": "Cells are', finishReason: 'MAX_TOKENS' }));
        const error = await failure(ask());
        expect(error.code).toBe('invalid_output');
        expect(error.message).toMatch(/not valid JSON \(MAX_TOKENS\)/);
        expect(friendlyError(error)).toMatch(/couldn't get good questions/);
    });

    test('plain text instead of JSON', async () => {
        gemini.reply(() => ({ text: 'Sure! Here is your reviewer.' }));
        expect((await failure(ask())).code).toBe('invalid_output');
    });
});

describe('errors from Gemini', () => {
    const cases = [
        ['an invalid key', GEMINI_ERRORS.badKey, { retry: false, setup: true, says: /aren't working on our side/ }],
        ['a leaked or blocked key', GEMINI_ERRORS.leakedKey, { retry: false, setup: true, says: /aren't working on our side/ }],
        ['a model that does not exist', GEMINI_ERRORS.noModel, { retry: false, setup: true, says: /aren't working on our side/ }],
        ['a rate limit', GEMINI_ERRORS.busy, { retry: true, setup: false, says: /busy right now/ }],
        ['an overloaded model', GEMINI_ERRORS.overloaded, { retry: true, setup: false, says: /had a problem/ }],
        ['material that is too big', GEMINI_ERRORS.tooBig, { retry: false, setup: false, says: /different PDF/ }],
    ];
    test.each(cases)('%s', async (_, reply, expected) => {
        gemini.reply(() => ({ error: reply }));
        const error = await failure(ask());
        expect(error.status).toBe(reply.status);
        expect(isRetryable(error)).toBe(expected.retry);
        expect(isSetupProblem(error)).toBe(expected.setup);
        expect(friendlyError(error)).toMatch(expected.says);
        // What a student sees never includes Gemini's own wording or the key.
        expect(friendlyError(error)).not.toMatch(/API key|quota|INVALID|test-key/);
        if (expected.setup) expect(describeError(error)).toMatch(/check GEMINI_API_KEY and GEMINI_MODEL/);
    });

    test('a request that takes too long is stopped, and counts as a timeout', async () => {
        geminiSettings.timeoutMs = 300;
        gemini.reply(() => ({ delayMs: 3000, json: {} }));
        const started = Date.now();
        const error = await failure(ask());
        expect(Date.now() - started).toBeLessThan(2500);
        expect(isTimeout(error)).toBe(true);
        expect(isRetryable(error)).toBe(true);
        expect(friendlyError(error)).toMatch(/took too long/);
    });

    test('a gateway timeout from Gemini is a timeout too', async () => {
        gemini.reply(() => ({ status: 504, message: 'Deadline expired before operation could complete.' }));
        const error = await failure(ask());
        expect(isTimeout(error)).toBe(true);
        expect(friendlyError(error)).toMatch(/took too long/);
    });
});

describe('withRetries', () => {
    test('asks again while it is worth it, then gives up', async () => {
        gemini.reply(() => ({ error: GEMINI_ERRORS.busy }));
        const waits = [];
        const error = await failure(withRetries(ask, [0, 0, 0], (_, wait) => waits.push(wait)));
        expect(error.status).toBe(429);
        expect(gemini.requests).toHaveLength(4);
        expect(waits).toEqual([0, 0, 0]);
    });

    test('stops at once on a setup problem', async () => {
        gemini.reply(() => ({ error: GEMINI_ERRORS.badKey }));
        await failure(withRetries(ask, [0, 0, 0]));
        expect(gemini.requests).toHaveLength(1);
    });

    test('returns the first good answer', async () => {
        gemini.reply((_, n) => (n < 3 ? { error: GEMINI_ERRORS.overloaded } : { json: { ok: true } }));
        expect((await withRetries(ask, [0, 0, 0])).data).toEqual({ ok: true });
        expect(gemini.requests).toHaveLength(3);
    });
});
