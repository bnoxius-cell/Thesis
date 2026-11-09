import { describe, test, expect } from 'vitest';
import {
    MAX_SOURCES,
    SOURCE_ACCEPT,
    canPickStored,
    limitMessage,
    problemsMessage,
    reviewerPayload,
    sourceCounter,
    sourceProblem,
    takeSources,
    usableSources,
} from '../../client/src/features/study/reviewerForm.js';
import { MAX_SOURCES_BYTES, MAX_SOURCE_BYTES } from '../utils/reviewerSource.js';

const MB = 1024 * 1024;
const file = (name, size = 1000) => ({ name, size });

describe('New reviewer form: the numbers match the server', () => {
    test('caps are the same as reviewerSource.js', () => {
        expect(MAX_SOURCES).toBe(10);
        expect(takeSources([], [file('a.pdf', MAX_SOURCE_BYTES)]).entries).toHaveLength(1);
        expect(sourceProblem(file('a.pdf', MAX_SOURCE_BYTES + 1))).toMatch(/too big/);
        expect(sourceCounter([file('a.pdf', MAX_SOURCES_BYTES)])).toBe('1 file · 20 MB of 20 MB');
    });

    test('accept lists every kind a reviewer can read, and none it cannot', () => {
        const accepted = SOURCE_ACCEPT.split(',');
        for (const ext of ['.pdf', '.docx', '.pptx', '.png', '.jpg', '.jpeg', '.webp']) expect(accepted).toContain(ext);
        for (const ext of ['.xlsx', '.txt', '.md']) expect(accepted).not.toContain(ext);
    });
});

describe('sourceProblem', () => {
    test('PDF, Word, PowerPoint and photos pass, whatever the letter case', () => {
        for (const name of ['a.pdf', 'A.DOCX', 'slides.pptx', 'p.png', 'p.JPG', 'p.jpeg', 'p.webp']) {
            expect(sourceProblem(file(name))).toBe('');
        }
    });

    test('Excel, text and unknown files are refused by name', () => {
        expect(sourceProblem(file('grades.xlsx'))).toBe(
            "grades.xlsx can't be made into a reviewer. Use PDF, Word or PowerPoint files, or photos (PNG, JPG or WebP).",
        );
        expect(sourceProblem(file('notes.txt'))).toMatch(/^notes\.txt can't be made/);
        expect(sourceProblem(file('noextension'))).toMatch(/^noextension can't be made/);
    });

    test('a file over 10 MB is refused by name', () => {
        expect(sourceProblem(file('big.pdf', 10 * MB))).toBe('');
        expect(sourceProblem(file('big.pdf', 10 * MB + 1))).toBe('big.pdf is too big. Each file can be up to 10 MB.');
    });
});

describe('takeSources', () => {
    test('adds the good files and leaves the bad one out with its message', () => {
        const { entries, problems } = takeSources([], [file('a.pptx'), file('b.xlsx'), file('c.jpg')]);
        expect(entries.map((entry) => entry.file.name)).toEqual(['a.pptx', 'c.jpg']);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/^b\.xlsx can't be made/);
    });

    test('keeps what was there and gives every entry its own id', () => {
        const first = takeSources([], [file('a.pdf')]).entries;
        const second = takeSources(first, [file('b.pdf'), file('c.pdf')]).entries;
        expect(second.map((entry) => entry.file.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
        expect(new Set(second.map((entry) => entry.id)).size).toBe(3);
        expect(first).toHaveLength(1);
    });

    test('the 11th file is refused, once, and the first ten stay', () => {
        const many = Array.from({ length: 12 }, (_, i) => file(`f${i}.pdf`));
        const { entries, problems } = takeSources([], many);
        expect(entries).toHaveLength(10);
        expect(problems).toEqual(['You can add up to 10 files to one reviewer.']);
    });

    test('files past 20 MB together are refused; a smaller one that still fits is added', () => {
        const current = takeSources([], [file('a.pdf', 10 * MB), file('b.pdf', 8 * MB)]).entries;
        const { entries, problems } = takeSources(current, [file('c.pdf', 3 * MB), file('d.pdf', MB)]);
        expect(entries.map((entry) => entry.file.name)).toEqual(['a.pdf', 'b.pdf', 'd.pdf']);
        expect(problems).toEqual(['Those files are too big together. The limit is 20 MB for one reviewer.']);
    });

    test('picking nothing changes nothing', () => {
        expect(takeSources([], [])).toEqual({ entries: [], problems: [] });
    });
});

describe('problemsMessage', () => {
    test('nothing, one problem, or the first and how many more', () => {
        expect(problemsMessage([])).toBe('');
        expect(problemsMessage(['One.'])).toBe('One.');
        expect(problemsMessage(['One.', 'Two.', 'Three.'])).toBe("One. 2 more couldn't be added.");
    });
});

describe('stored files', () => {
    const stored = [
        { id: '1', ext: 'pdf', size: 1 },
        { id: '2', ext: 'xlsx', size: 1 },
        { id: '3', ext: 'docx', size: 1 },
        { id: '4', ext: 'txt', size: 1 },
        { id: '5', ext: 'webp', size: 1 },
        { id: '6', ext: 'pptx', size: 1 },
    ];

    test('usableSources keeps only the kinds a reviewer can read', () => {
        expect(usableSources(stored).map((f) => f.id)).toEqual(['1', '3', '5', '6']);
        expect(usableSources([])).toEqual([]);
    });

    test('canPickStored stops at 10 files and at 20 MB', () => {
        const ten = Array.from({ length: 10 }, (_, i) => ({ id: String(i), size: 1 }));
        expect(canPickStored(ten.slice(0, 9), { size: 1 })).toBe(true);
        expect(canPickStored(ten, { size: 1 })).toBe(false);
        expect(canPickStored([{ size: 15 * MB }], { size: 5 * MB })).toBe(true);
        expect(canPickStored([{ size: 15 * MB }], { size: 5 * MB + 1 })).toBe(false);
    });
});

describe('sourceCounter', () => {
    test('reads "3 files · 14.2 MB of 20 MB"', () => {
        const items = [file('a', 4 * MB), file('b', 5 * MB), file('c', 5.2 * MB)];
        expect(sourceCounter(items)).toBe('3 files · 14.2 MB of 20 MB');
        expect(sourceCounter([file('a', 890 * 1024)])).toBe('1 file · 890 KB of 20 MB');
    });
});

describe('limitMessage', () => {
    test('blocks when reviewers are off or the day is used up', () => {
        expect(limitMessage(null)).toBe('');
        expect(limitMessage({ enabled: true, dailyLimit: 5, usedToday: 4 })).toBe('');
        expect(limitMessage({ enabled: false, dailyLimit: 5, usedToday: 0 })).toMatch(/aren't set up/);
        expect(limitMessage({ enabled: true, dailyLimit: 5, usedToday: 5 })).toMatch(/today's limit/);
    });
});

describe('reviewerPayload', () => {
    const fields = { title: '  Week 3 ', subject: 'abc', count: 20 };

    test('an upload sends each file as a repeated `files` field and no fileIds', () => {
        const form = reviewerPayload({ ...fields, kind: 'upload', files: [new File(['a'], 'a.pdf'), new File(['b'], 'b.pptx')] });
        expect(form.get('title')).toBe('Week 3');
        expect(form.get('subject')).toBe('abc');
        expect(form.get('questionCount')).toBe('20');
        expect(form.getAll('files').map((f) => f.name)).toEqual(['a.pdf', 'b.pptx']);
        expect(form.has('fileIds')).toBe(false);
        expect(form.has('pdf')).toBe(false);
    });

    test('stored files send one comma-separated `fileIds` field and no files', () => {
        const form = reviewerPayload({ ...fields, kind: 'stored', files: [new File(['a'], 'a.pdf')], fileIds: ['1', '2'] });
        expect(form.get('fileIds')).toBe('1,2');
        expect(form.has('files')).toBe(false);
    });

    test('no subject leaves the field out', () => {
        const form = reviewerPayload({ ...fields, subject: '', kind: 'upload', files: [] });
        expect(form.has('subject')).toBe(false);
    });
});
