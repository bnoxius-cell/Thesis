import { describe, test, expect } from 'vitest';
import { buildCheckInResult, meaningOf, directionOf } from '../../client/src/utils/checkinResult.js';

const sug = { taskId: 't1', title: 'Report' };
const sleep = { text: 'Be in bed by 10:30 PM.' };

describe('meaning', () => {
    test.each([
        ['pss', 0, 'lower side'], ['pss', 13, 'lower side'],
        ['pss', 14, 'fair amount'], ['pss', 26, 'fair amount'],
        ['pss', 27, 'a lot'], ['pss', 40, 'a lot'],
        ['who', 100, 'mostly okay'], ['who', 52, 'mostly okay'],
        ['who', 50, 'lower than they could be'], ['who', 29, 'lower than they could be'],
        ['who', 28, 'hard'], ['who', 0, 'hard'],
    ])('%s %i', (kind, score, text) => {
        expect(meaningOf(kind, score)).toContain(text);
    });
});

describe('direction', () => {
    test('stress going down is better, well-being going down is worse', () => {
        expect(directionOf('pss', 15, 25)).toBe('better');
        expect(directionOf('pss', 25, 15)).toBe('worse');
        expect(directionOf('who', 70, 40)).toBe('better');
        expect(directionOf('who', 40, 70)).toBe('worse');
    });
    test('small moves are the same, no earlier result is null', () => {
        expect(directionOf('pss', 20, 21)).toBe('same');
        expect(directionOf('who', 52, 56)).toBe('same');
        expect(directionOf('pss', 20, null)).toBeNull();
    });
    test('the sentence and score line are added to the result', () => {
        const r = buildCheckInResult({ kind: 'pss', score: 30, previousScore: 20 });
        expect(r.directionText).toBe("That's harder than last time.");
        expect(buildCheckInResult({ kind: 'pss', score: 30 }).directionText).toBe('');
        expect(r.scoreLine).toBe('PSS-10: 30 of 40');
        expect(buildCheckInResult({ kind: 'who', score: 52 }).scoreLine).toBe('WHO-5: 52 of 100');
    });
});

describe('plan', () => {
    test('strained with a suggestion offers the move and warns sooner', () => {
        const r = buildCheckInResult({ kind: 'pss', score: 30, pssScore: 30, strained: true, suggestion: sug });
        expect(r.plan).toEqual({ suggestion: sug, warnSooner: true, fits: false });
    });
    test('strained without a suggestion says the week fits', () => {
        const r = buildCheckInResult({ kind: 'pss', score: 30, pssScore: 30, strained: true });
        expect(r.plan).toEqual({ suggestion: null, warnSooner: true, fits: true });
    });
    test('not strained never offers a move', () => {
        const r = buildCheckInResult({ kind: 'pss', score: 10, pssScore: 10, suggestion: sug });
        expect(r.plan).toEqual({ suggestion: null, warnSooner: false, fits: true });
    });
});

describe('one thing for today', () => {
    test('the bedtime comes first', () => {
        const r = buildCheckInResult({ kind: 'pss', score: 30, pssScore: 30, sleep, smallestTask: 'Quiz' });
        expect(r.today).toEqual({ kind: 'sleep', text: sleep.text });
    });
    test('high stress picks the smallest task, by name when there is one', () => {
        expect(buildCheckInResult({ kind: 'pss', score: 30, pssScore: 30, smallestTask: 'Quiz' }).today.text).toContain('"Quiz"');
        expect(buildCheckInResult({ kind: 'pss', score: 30, pssScore: 30 }).today.kind).toBe('small-task');
    });
    test('low well-being asks for something enjoyable', () => {
        expect(buildCheckInResult({ kind: 'who', score: 30, whoScore: 30 }).today.kind).toBe('enjoy');
    });
    test('a fresh high PSS still counts when the WHO-5 was just taken', () => {
        expect(buildCheckInResult({ kind: 'who', score: 70, whoScore: 70, pssScore: 33 }).today.kind).toBe('small-task');
    });
    test('otherwise keep it steady', () => {
        expect(buildCheckInResult({ kind: 'pss', score: 8, pssScore: 8 }).today.kind).toBe('steady');
    });
});

describe('encouragement', () => {
    test('uses real finished tasks', () => {
        expect(buildCheckInResult({ kind: 'pss', score: 8, finishedCount: 4 }).encouragement).toEqual(["You've finished 4 tasks this week. That counts."]);
        expect(buildCheckInResult({ kind: 'pss', score: 8, finishedCount: 1 }).encouragement[0]).toContain('1 task this week');
    });
    test('falls back to the check-in itself', () => {
        expect(buildCheckInResult({ kind: 'pss', score: 8 }).encouragement[0]).toContain('Checking in is a good step');
    });
    test('a hard result adds a kind line', () => {
        const r = buildCheckInResult({ kind: 'pss', score: 33, pssScore: 33, finishedCount: 2 });
        expect(r.encouragement).toHaveLength(2);
        expect(r.encouragement[1]).toBe("You don't have to fix the whole week today.");
    });
});
