import { describe, test, expect } from 'vitest';
import { normalizeTyped, gradeTyped, gradeList, essayPassed } from '../utils/reviewerAnswers.js';

describe('normalizeTyped', () => {
    test('ignores case, accents, punctuation and one leading article', () => {
        expect(normalizeTyped('  The CPU! ')).toBe('cpu');
        expect(normalizeTyped('Ángulo')).toBe('angulo');
        expect(normalizeTyped('TCP/IP')).toBe('tcp ip');
        expect(normalizeTyped('Research & Development')).toBe('research and development');
        expect(normalizeTyped('Ang Router')).toBe('router');
        expect(normalizeTyped('the the cpu')).toBe('the cpu');
        expect(normalizeTyped(null)).toBe('');
    });
});

describe('gradeTyped', () => {
    const cpu = { answer: 'CPU', accepted: ['Central Processing Unit'] };

    test('matches the answer or an accepted form', () => {
        expect(gradeTyped('the cpu', cpu)).toBe(true);
        expect(gradeTyped('central processing unit', cpu)).toBe(true);
        expect(gradeTyped('gpu', cpu)).toBe(false);
        expect(gradeTyped('   ', cpu)).toBe(false);
    });

    test('accents and punctuation do not matter', () => {
        expect(gradeTyped('Ángulo', { answer: 'angulo' })).toBe(true);
        expect(gradeTyped('tcp ip', { answer: 'TCP/IP' })).toBe(true);
        expect(gradeTyped('datalink', { answer: 'data link' })).toBe(true);
    });

    test('forgives one typo from 5 letters and two from 10, but never in short answers', () => {
        expect(gradeTyped('databse', { answer: 'database' })).toBe(true);
        expect(gradeTyped('rom', { answer: 'ram' })).toBe(false);
        expect(gradeTyped('rams', { answer: 'ram' })).toBe(false);
        expect(gradeTyped('photosynthsis', { answer: 'photosynthesis' })).toBe(true);
        expect(gradeTyped('photosnthsis', { answer: 'photosynthesis' })).toBe(true);
        expect(gradeTyped('photosnthss', { answer: 'photosynthesis' })).toBe(false);
        expect(gradeTyped('datbse', { answer: 'database' })).toBe(false);
    });

    test('answers with digits must match exactly', () => {
        expect(gradeTyped('1023', { answer: '1024' })).toBe(false);
        expect(gradeTyped('layer 4', { answer: 'Layer 3' })).toBe(false);
        expect(gradeTyped('1024', { answer: '1024' })).toBe(true);
    });
});

describe('gradeList', () => {
    const layers = [
        { answer: 'Application', accepted: [] },
        { answer: 'Transport', accepted: [] },
        { answer: 'Internet', accepted: ['Network'] },
        { answer: 'Link', accepted: ['Network access'] },
    ];

    test('order does not matter', () => {
        const out = gradeList(['link', 'Internet', 'application', 'transport'], layers);
        expect(out).toEqual({ got: 4, of: 4, matched: [3, 2, 0, 1] });
    });

    test('a repeated entry counts once', () => {
        const out = gradeList(['Transport', 'transport.', 'Application'], layers);
        expect(out.got).toBe(2);
        expect(out.matched).toEqual([1, -1, 0]);
    });

    test('three right and one wrong is not everything', () => {
        const out = gradeList(['Application', 'Transport', 'Internet', 'Physical'], layers);
        expect(out).toMatchObject({ got: 3, of: 4 });
        expect(out.got === out.of).toBe(false);
    });

    test('empty entries are ignored', () => {
        const out = gradeList(['', '  ', 'Link'], layers);
        expect(out).toEqual({ got: 1, of: 4, matched: [-1, -1, 3] });
    });

    test('an item can only be claimed once, even by two ways of writing it', () => {
        const out = gradeList(['Network', 'Internet'], layers);
        expect(out).toMatchObject({ got: 1, matched: [2, -1] });
    });
});

describe('essayPassed', () => {
    test('needs two thirds of the key points, rounded up', () => {
        expect(essayPassed(2, 2)).toBe(true);
        expect(essayPassed(1, 2)).toBe(false);
        expect(essayPassed(2, 3)).toBe(true);
        expect(essayPassed(2, 4)).toBe(false);
        expect(essayPassed(3, 4)).toBe(true);
    });
});
