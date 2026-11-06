import { describe, test, expect } from 'vitest';
import { formatSize } from '../../client/src/shared/lib/formatSize.js';
import { FILE_ACCEPT, MAX_FILE_BYTES, MAX_LIBRARY_FILES, extensionOf, fileLabel, fileProblem, isPhoto } from '../../client/src/features/files/fileRules.js';
import { getFileLimits } from '../utils/fileLimits.js';

const MB = 1024 * 1024;

describe('formatSize', () => {
    test('nothing reads 0 MB; small files read in KB, never 0 KB', () => {
        expect(formatSize(0)).toBe('0 MB');
        expect(formatSize(1)).toBe('1 KB');
        expect(formatSize(300)).toBe('1 KB');
        expect(formatSize(890 * 1024)).toBe('890 KB');
    });

    test('megabytes keep one decimal, rounded up, and drop ".0"', () => {
        expect(formatSize(1.5 * MB)).toBe('1.5 MB');
        expect(formatSize(2_100_000)).toBe('2.1 MB'); // 2.003 MB rounds up
        expect(formatSize(MB)).toBe('1 MB');
        expect(formatSize(MAX_FILE_BYTES)).toBe('10 MB');
        expect(formatSize(MAX_FILE_BYTES + 1)).toBe('10.1 MB');
    });
});

describe('file rules', () => {
    const file = (name, size = 1000) => ({ name, size });

    test('labels come from the same list the picker allows', () => {
        expect(fileLabel('pdf')).toBe('PDF');
        expect(fileLabel('pptx')).toBe('PowerPoint');
        expect(fileLabel('markdown')).toBe('Text');
        expect(fileLabel('exe')).toBe('File');
        expect(fileLabel('constructor')).toBe('File');
        expect(FILE_ACCEPT).toContain('.markdown');
    });

    test('the limits the page shows match the server', () => {
        expect(MAX_LIBRARY_FILES).toBe(getFileLimits().maxLibraryFiles);
        expect(MAX_FILE_BYTES).toBe(getFileLimits().maxFileBytes);
    });

    test('photos are the image types only', () => {
        expect(['png', 'jpg', 'jpeg', 'webp'].every(isPhoto)).toBe(true);
        expect(isPhoto('pdf')).toBe(false);
        expect(isPhoto(undefined)).toBe(false);
    });

    test('extension is the last part, lower case', () => {
        expect(extensionOf('Notes.Final.PDF')).toBe('pdf');
    });

    test('a known type under the limit can be sent', () => {
        expect(fileProblem(file('notes.md'))).toBe('');
        expect(fileProblem(file('photo.JPG', MAX_FILE_BYTES))).toBe('');
    });

    test('an unknown type or a file over the limit is refused with a plain message', () => {
        expect(fileProblem(file('setup.exe'))).toMatch(/can't be sent/);
        expect(fileProblem(file('scan.pdf', MAX_FILE_BYTES + 1))).toBe('That file is too big. The limit is 10 MB.');
    });
});
