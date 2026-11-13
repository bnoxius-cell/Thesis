import { describe, test, expect } from 'vitest';
import {
    INTERVAL_DAYS, MASTERED_BOX, applyRating, deckStatus, isDue, nextDueDays, phDayStart, tomorrowStart,
} from '../utils/flashcardSchedule.js';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso) => new Date(iso);
const NOW = at('2026-11-07T04:00:00Z');
const card = (extra = {}) => ({ box: 0, dueAt: NOW, reviews: 0, lapses: 0, ...extra });

describe('Philippine days', () => {
    test('a day starts at 16:00 UTC the evening before', () => {
        expect(phDayStart(at('2026-11-07T15:59:00Z'))).toEqual(at('2026-11-06T16:00:00Z'));
        expect(phDayStart(at('2026-11-07T16:00:00Z'))).toEqual(at('2026-11-07T16:00:00Z'));
    });

    test('tomorrow starts one day after today does', () => {
        expect(tomorrowStart(NOW)).toEqual(at('2026-11-07T16:00:00Z'));
    });

    test('a card is due for the whole of its day', () => {
        expect(isDue(at('2026-11-07T15:59:00Z'), NOW)).toBe(true);
        expect(isDue(at('2026-11-07T16:00:00Z'), NOW)).toBe(false);
        expect(isDue(at('2026-11-01T00:00:00Z'), NOW)).toBe(true);
    });

    test('nextDueDays counts whole Philippine days from today', () => {
        expect(nextDueDays(at('2026-11-07T20:00:00Z'), NOW)).toBe(1);
        expect(nextDueDays(at('2026-11-09T10:00:00Z'), NOW)).toBe(2);
        expect(nextDueDays(NOW, NOW)).toBe(0);
    });
});

describe('applyRating', () => {
    test('got on a new card moves it to box 1, due at the next Philippine midnight', () => {
        const result = applyRating(card(), 'got', NOW);
        expect(result.counted).toBe(true);
        expect(result.fields).toMatchObject({ box: 1, dueAt: at('2026-11-07T16:00:00Z'), reviews: 1, reviewedAt: NOW });
    });

    test('got climbs one box at a time and waits the box interval', () => {
        const result = applyRating(card({ box: 2 }), 'got', NOW);
        expect(result.fields.box).toBe(3);
        expect(result.fields.dueAt).toEqual(new Date(phDayStart(NOW).getTime() + INTERVAL_DAYS[3] * DAY));
    });

    test('box 5 stays 5 with a 30 day gap', () => {
        const result = applyRating(card({ box: 5 }), 'got', NOW);
        expect(result.fields.box).toBe(5);
        expect(result.fields.dueAt).toEqual(new Date(phDayStart(NOW).getTime() + 30 * DAY));
    });

    test('got on a card that is not due counts for nothing', () => {
        const notDue = card({ box: 2, dueAt: at('2026-11-10T00:00:00Z') });
        expect(applyRating(notDue, 'got', NOW)).toEqual({ counted: false });
    });

    test('learning from box 3 goes back to box 0, due now, with a lapse', () => {
        const result = applyRating(card({ box: 3, reviews: 5, dueAt: at('2026-11-20T00:00:00Z') }), 'learning', NOW);
        expect(result.counted).toBe(true);
        expect(result.fields).toMatchObject({ box: 0, dueAt: NOW, lapses: 1, reviews: 6, reviewedAt: NOW });
    });

    test('learning from box 1 is not a lapse', () => {
        expect(applyRating(card({ box: 1 }), 'learning', NOW).fields.lapses).toBe(0);
    });

    test('learning twice leaves the same box, due time and lapses', () => {
        const first = applyRating(card({ box: 3 }), 'learning', NOW).fields;
        const second = applyRating({ ...card(), ...first }, 'learning', NOW).fields;
        expect({ box: second.box, dueAt: second.dueAt, lapses: second.lapses }).toEqual({ box: first.box, dueAt: first.dueAt, lapses: first.lapses });
    });

    test('anything else is refused', () => {
        ['easy', '', undefined, null, { rating: 'got' }].forEach((rating) => expect(applyRating(card(), rating, NOW)).toBeNull());
    });
});

describe('deckStatus', () => {
    test('is new for an empty deck and one nothing was reviewed in', () => {
        expect(deckStatus({ cards: 0, reviewed: 0, mastered: 0 })).toBe('new');
        expect(deckStatus({ cards: 5, reviewed: 0, mastered: 0 })).toBe('new');
    });

    test('is learning once something was reviewed, mastered when every card is in a mastered box', () => {
        expect(deckStatus({ cards: 5, reviewed: 2, mastered: 1 })).toBe('learning');
        expect(deckStatus({ cards: 5, reviewed: 5, mastered: 5 })).toBe('mastered');
        expect(MASTERED_BOX).toBe(4);
    });
});
