import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeMoreQuestions, WAVES_STOP_AFTER_MS } from '../utils/reviewerMoreQuestions.js';
import { generateJson } from '../utils/gemini.js';

// The waves that write questions past the first round (plan 21, 3.10), with Gemini mocked.
vi.mock('../utils/gemini.js', () => ({ generateJson: vi.fn() }));
vi.spyOn(console, 'error').mockImplementation(() => {});

const TOPICS = ['Cells', 'Energy'];
const question = (prompt) => ({
    topic: 'Cells', prompt, options: [`${prompt} a`, `${prompt} b`, `${prompt} c`, `${prompt} d`], correctIndex: 0, explanation: 'Because.', difficulty: 'easy',
});
const batch = (tag, n) => ({ questions: Array.from({ length: n }, (_, i) => question(`${tag} question ${i + 1}?`)) });
const made = (n) => Array.from({ length: n }, (_, i) => ({ ...question(`Made question ${i + 1}?`), topic: 'Cells' }));

const reply = (...answers) => {
    generateJson.mockReset();
    for (const data of answers) generateJson.mockResolvedValueOnce({ data, model: 'gemini-test' });
};
const run = (overrides = {}) => writeMoreQuestions({
    title: 'Biology', course: '', parts: ['The cell makes energy.'], topics: TOPICS, questions: made(30), target: 100,
    retry: (request) => request(), deadline: Date.now() + WAVES_STOP_AFTER_MS, onProgress: vi.fn(), ...overrides,
});
const promptOf = (call) => generateJson.mock.calls[call][0].prompt;

beforeEach(() => generateJson.mockReset());
afterEach(() => vi.useRealTimers());

describe('writeMoreQuestions', () => {
    test('asks two calls at a time, each showing what was written so far', async () => {
        reply(batch('A', 25), batch('B', 25), batch('C', 20));
        const onProgress = vi.fn();
        const extra = await run({ onProgress });

        expect(extra).toHaveLength(70);
        expect(generateJson).toHaveBeenCalledTimes(3);
        expect(promptOf(0)).toContain('exactly 25 new');
        expect(promptOf(1)).toContain('exactly 25 new');
        expect(promptOf(2)).toContain('exactly 20 new');
        // The first wave sees the 30 made so far; the second also sees the 50 from the first wave.
        expect(promptOf(0)).toContain('- Made question 30?');
        expect(promptOf(0)).not.toContain('A question 1?');
        expect(promptOf(2)).toContain('- A question 25?');
        expect(promptOf(2)).toContain('- B question 25?');
        expect(onProgress.mock.calls).toEqual([[80, 100], [100, 100]]);
    });

    test('shares what is left evenly when it is less than two full calls', async () => {
        reply(batch('A', 15), batch('B', 15));
        await run({ questions: made(70), target: 100 });
        expect(promptOf(0)).toContain('exactly 15 new');
        expect(promptOf(1)).toContain('exactly 15 new');
    });

    test('never goes past the target', async () => {
        reply(batch('A', 25), batch('B', 25));
        const extra = await run({ questions: made(60), target: 100 });
        expect(extra).toHaveLength(40);
    });

    test('keeps a question that two calls at the same time both wrote once', async () => {
        reply(batch('A', 25), batch('A', 25), batch('B', 20));
        const extra = await run();
        expect(extra.filter((q) => q.prompt === 'A question 1?')).toHaveLength(1);
        expect(extra).toHaveLength(25 + 20);
    });

    test('drops questions that repeat one already made', async () => {
        reply({ questions: [question('Made question 1?'), question('Brand new?')] });
        const extra = await run({ target: 32 });
        expect(extra.map((q) => q.prompt)).toEqual(['Brand new?']);
    });

    test('stops when a wave adds less than half of what it asked for', async () => {
        reply(batch('A', 5), batch('B', 5));
        const extra = await run();
        expect(extra).toHaveLength(10);
        expect(generateJson).toHaveBeenCalledTimes(2);
    });

    test('a thin answer is not asked for again', async () => {
        reply({ questions: [] }, { questions: [] });
        expect(await run()).toEqual([]);
        expect(generateJson).toHaveBeenCalledTimes(2);
    });

    test('an answer that is not usable at all is retried', async () => {
        reply(null, batch('A', 25), batch('B', 25), batch('C', 20));
        const extra = await run({ retry: async (request) => { try { return await request(); } catch { return request(); } } });
        expect(extra).toHaveLength(70);
    });

    test('a failed call ends the waves and keeps what the other call wrote', async () => {
        generateJson.mockResolvedValueOnce({ data: batch('A', 25), model: 'gemini-test' });
        generateJson.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }));
        const extra = await run();
        expect(extra).toHaveLength(25);
        expect(generateJson).toHaveBeenCalledTimes(2);
    });

    test('starts no wave once the deadline has passed', async () => {
        expect(await run({ deadline: Date.now() - 1 })).toEqual([]);
        expect(generateJson).not.toHaveBeenCalled();
    });

    test('checks the deadline between waves and never cuts a call off', async () => {
        const deadline = Date.now() + 60_000;
        generateJson.mockImplementationOnce(async () => ({ data: batch('A', 25), model: 'gemini-test' }));
        generateJson.mockImplementationOnce(async () => ({ data: batch('B', 25), model: 'gemini-test' }));
        const extra = await run({ deadline, onProgress: () => { vi.setSystemTime(deadline + 1); } });
        expect(extra).toHaveLength(50);
        expect(generateJson).toHaveBeenCalledTimes(2);
    });

    test('takes the parts in turn, longest first', async () => {
        reply(batch('A', 25), batch('B', 25), batch('C', 20));
        await run({ parts: ['Short part.', 'A much longer second part of the material.'] });
        expect(promptOf(0)).toContain('A much longer second part');
        expect(promptOf(1)).toContain('Short part.');
        expect(promptOf(2)).toContain('A much longer second part');
    });
});
