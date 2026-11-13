import { describe, test, expect } from 'vitest';
import { RELEASE_NOTES, NOTE_TAGS } from '../../client/src/features/whats-new/releaseNotes.js';
import { unseenNotes } from '../../client/src/features/whats-new/unseenNotes.js';

const ID_PATTERN = /^\d{4}-\d{2}-\d{2}(-\d{1,2})?$/;
const JARGON = /\b(api|bug|bugs|deploy|server|cache|refactor)\b/i;
const texts = RELEASE_NOTES.flatMap((n) => [n.title ?? '', ...n.items.map((i) => i.text)]);

describe('release notes file', () => {
    test('has at least one entry, with unique ids in the id pattern', () => {
        expect(RELEASE_NOTES.length).toBeGreaterThan(0);
        const ids = RELEASE_NOTES.map((n) => n.id);
        expect(new Set(ids).size).toBe(ids.length);
        ids.forEach((id) => expect(id).toMatch(ID_PATTERN));
    });

    test('is newest first by id date', () => {
        const dates = RELEASE_NOTES.map((n) => n.id.slice(0, 10));
        expect(dates).toEqual([...dates].sort().reverse());
    });

    test('every entry has 1 to 6 items with a known tag and short text', () => {
        for (const note of RELEASE_NOTES) {
            expect(note.items.length).toBeGreaterThanOrEqual(1);
            expect(note.items.length).toBeLessThanOrEqual(6);
            for (const item of note.items) {
                expect(Object.keys(NOTE_TAGS)).toContain(item.tag);
                expect(item.text.trim().length).toBeGreaterThan(0);
                expect(item.text.length).toBeLessThanOrEqual(140);
            }
        }
    });

    test('no em or en dashes and no jargon', () => {
        texts.forEach((text) => {
            expect(text).not.toMatch(/[–—]/);
            expect(text).not.toMatch(JARGON);
        });
    });
});

describe('unseenNotes', () => {
    const notes = [{ id: '2026-11-20' }, { id: '2026-11-14' }, { id: '2026-11-01' }, { id: '2026-10-20' }];
    const old = '2026-01-01T00:00:00Z';

    test('nothing to show when the newest is seen or there are no notes', () => {
        expect(unseenNotes(notes, '2026-11-20', old)).toEqual({ entries: [], silent: false });
        expect(unseenNotes([], '', old)).toEqual({ entries: [], silent: false });
    });

    test('a new account is marked seen silently', () => {
        expect(unseenNotes(notes, '', '2026-11-20T08:00:00')).toEqual({ entries: [], silent: true });
    });

    test('an older account with nothing seen gets only the newest entry', () => {
        expect(unseenNotes(notes, '', old)).toEqual({ entries: [notes[0]], silent: false });
    });

    test('an unknown seen id gets only the newest entry', () => {
        expect(unseenNotes(notes, '2026-05-05', old).entries).toEqual([notes[0]]);
    });

    test('shows everything newer than the seen id', () => {
        expect(unseenNotes(notes, '2026-11-01', old).entries).toEqual([notes[0], notes[1]]);
    });
});
