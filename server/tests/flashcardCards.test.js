import { describe, test, expect } from 'vitest';
import { readCardFields } from '../utils/flashcardCards.js';
import { FLASHCARD_LIMITS } from '../models/flashcardDeckModel.js';

describe('readCardFields', () => {
    test('cleans the term to one line and keeps the answer line breaks', () => {
        expect(readCardFields({ term: '  Subnet \n  mask ', answer: ' First line\r\nSecond line\n\n\n\nThird ' }))
            .toEqual({ term: 'Subnet mask', answer: 'First line\nSecond line\n\nThird' });
    });

    test('allows exactly the limits and refuses one more character', () => {
        expect(readCardFields({ term: 'a'.repeat(400), answer: 'b'.repeat(1000) }).error).toBeUndefined();
        expect(readCardFields({ term: 'a'.repeat(401), answer: 'b' }).error).toBe('The term can be up to 400 characters.');
        expect(readCardFields({ term: 'a', answer: 'b'.repeat(1001) }).error).toBe('The answer can be up to 1000 characters.');
        expect(FLASHCARD_LIMITS.term).toBe(400);
    });

    test('refuses a blank term or answer', () => {
        expect(readCardFields({ term: '  ', answer: 'b' }).error).toBe('Give the card a term.');
        expect(readCardFields({ term: 'a', answer: ' \n ' }).error).toBe('Give the card an answer.');
    });

    test('reads strings only', () => {
        [{ a: 1 }, ['x'], 5, null, undefined, true].forEach((value) => {
            expect(readCardFields({ term: value, answer: 'b' }).error).toBeDefined();
            expect(readCardFields({ term: 'a', answer: value }).error).toBeDefined();
        });
    });
});
