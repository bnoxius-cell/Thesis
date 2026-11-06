import { describe, test, expect } from 'vitest';
import { GENERAL, countByPlace, filesIn, matchName, placeName, placeOf, placeOptions } from '../../client/src/features/files/places.js';

const locations = {
    subjects: [{ id: 's1', name: 'DBMS 101', color: 'blue' }, { id: 's2', name: 'SE 201', color: 'green' }],
    folders: [{ id: 'f1', name: 'Scholarships' }, { id: 'f2', name: 'Thesis' }],
};
const file = (name, location) => ({ name, location });
const files = [
    file('Normalization notes.pdf', { type: 'subject', id: 's1' }),
    file('Lab 3 handout.docx', { type: 'subject', id: 's2' }),
    file('Whiteboard photo.jpg', { type: 'general' }),
    file('Thesis outline.pdf', { type: 'folder', id: 'f2' }),
    file('Old notes.pdf', { type: 'subject', id: 'gone' }),
];

describe('places', () => {
    test('a location turns into the server\'s place text', () => {
        expect(placeOf({ type: 'general' })).toBe(GENERAL);
        expect(placeOf({ type: 'subject', id: 's1' })).toBe('subject:s1');
        expect(placeOf({ type: 'folder', id: 'f2' })).toBe('folder:f2');
    });

    test('a place is named from the lists, and an unknown subject is an archived one', () => {
        expect(placeName({ type: 'general' }, locations)).toBe('General');
        expect(placeName({ type: 'subject', id: 's2' }, locations)).toBe('SE 201');
        expect(placeName({ type: 'folder', id: 'f2' }, locations)).toBe('Thesis');
        expect(placeName({ type: 'subject', id: 'gone' }, locations)).toBe('Archived subject');
    });

    test('files are counted and listed per place', () => {
        expect(countByPlace(files)).toEqual({ 'subject:s1': 1, 'subject:s2': 1, general: 1, 'folder:f2': 1, 'subject:gone': 1 });
        expect(filesIn(files, 'folder:f2').map((f) => f.name)).toEqual(['Thesis outline.pdf']);
        expect(filesIn(files, 'folder:f1')).toEqual([]);
        expect(countByPlace([])).toEqual({});
    });

    test('search matches the name anywhere, ignoring case and outer spaces', () => {
        expect(matchName(files, 'THE').map((f) => f.name)).toEqual(['Thesis outline.pdf']);
        expect(matchName(files, '  notes ').map((f) => f.name)).toEqual(['Normalization notes.pdf', 'Old notes.pdf']);
        expect(matchName(files, 'zzz')).toEqual([]);
        expect(matchName(files, '   ')).toBe(files);
    });

    test('destinations are General, subjects in order, then folders, with no archived subject', () => {
        expect(placeOptions(locations).map((o) => o.value)).toEqual(['general', 'subject:s1', 'subject:s2', 'folder:f1', 'folder:f2']);
        expect(placeOptions({ subjects: [], folders: [] })).toEqual([{ value: 'general', label: 'General' }]);
    });
});
