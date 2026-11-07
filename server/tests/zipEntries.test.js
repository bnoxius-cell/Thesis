import { describe, test, expect } from 'vitest';
import { listZipEntries, readZipEntry, ZipError } from '../utils/zipEntries.js';
import { makeZip } from './helpers/fileFixtures.js';

const KB = 1024;

const onlyEntry = (zip) => listZipEntries(zip)[0];
const read = (zip, maxBytes = 64 * KB) => readZipEntry(zip, onlyEntry(zip), { maxBytes });
const zipErrorCode = (fn) => {
    try {
        fn();
    } catch (err) {
        expect(err).toBeInstanceOf(ZipError);
        return err.code;
    }
    throw new Error('expected a ZipError');
};

// Offsets inside the only central directory header of a ZIP without a comment.
const centralHeader = (zip) => zip.readUInt32LE(zip.length - 6);
const patched = (zip, field, value) => {
    const copy = Buffer.from(zip);
    copy.writeUInt32LE(value, centralHeader(copy) + field);
    return copy;
};
const COMPRESSED_SIZE = 20;
const UNCOMPRESSED_SIZE = 24;
const LOCAL_OFFSET = 42;

describe('listZipEntries', () => {
    test('lists every entry with its sizes, method and flags', () => {
        const zip = makeZip(['a.txt', { name: 'b.xml', data: 'hello hello hello', deflate: true }]);
        const [a, b] = listZipEntries(zip);
        expect(a).toMatchObject({ name: 'a.txt', method: 0, flags: 0, compressedSize: 1, uncompressedSize: 1, localOffset: 0 });
        expect(b).toMatchObject({ name: 'b.xml', method: 8, flags: 0, uncompressedSize: 17 });
        expect(b.localOffset).toBeGreaterThan(0);
        expect(a.centralOffset).toBe(centralHeader(zip));
    });

    test('anything that is not a plain ZIP is null', () => {
        expect(listZipEntries(Buffer.from('not a zip at all, just some text'))).toBeNull();
        expect(listZipEntries(makeZip([]))).toBeNull();
    });
});

describe('readZipEntry: good entries', () => {
    test('stored and deflated entries read back exactly', () => {
        const text = 'Mitochondria ang powerhouse ng cell. '.repeat(50);
        expect(read(makeZip([{ name: 'a.xml', data: text }])).toString()).toBe(text);
        expect(read(makeZip([{ name: 'a.xml', data: text, deflate: true }])).toString()).toBe(text);
    });

    test('binary data survives', () => {
        const bytes = Buffer.from([0, 1, 2, 250, 255, 0, 7]);
        expect(read(makeZip([{ name: 'a.bin', data: bytes, deflate: true }]))).toEqual(bytes);
    });

    test('the data start comes from the local header, whose extra field the directory lacks', () => {
        const zip = makeZip([{ name: 'a.xml', data: 'local extra', deflate: true, localExtra: Buffer.alloc(9, 0x41) }]);
        expect(read(zip).toString()).toBe('local extra');
    });

    test('with a data descriptor the sizes come from the central directory', () => {
        const zip = makeZip([{ name: 'a.xml', data: 'described later', deflate: true, flags: 0x0008 }]);
        expect(read(zip).toString()).toBe('described later');
    });

    test('an entry exactly at the cap is fine', () => {
        expect(read(makeZip([{ name: 'a.xml', data: 'x'.repeat(100), deflate: true }]), 100)).toHaveLength(100);
    });
});

describe('readZipEntry: refused entries', () => {
    test('an encrypted entry', () => {
        expect(zipErrorCode(() => read(makeZip([{ name: 'a.xml', data: 'secret', flags: 0x0001 }])))).toBe('encrypted');
    });

    test('an unsupported method', () => {
        expect(zipErrorCode(() => read(makeZip([{ name: 'a.xml', data: 'bzip2 data', method: 12 }])))).toBe('damaged');
    });

    test('a declared size over the cap is refused before inflating', () => {
        const zip = makeZip([{ name: 'zeros', data: Buffer.alloc(1024 * KB), deflate: true }]);
        expect(zipErrorCode(() => read(zip, 64 * KB))).toBe('too_big');
    });

    test('a size that lies is still capped while inflating', () => {
        const zip = patched(makeZip([{ name: 'zeros', data: Buffer.alloc(1024 * KB), deflate: true }]), UNCOMPRESSED_SIZE, 10);
        expect(zipErrorCode(() => read(zip, 64 * KB))).toBe('too_big');
    });

    test('a size that lies under the cap is damaged', () => {
        const zip = patched(makeZip([{ name: 'a.xml', data: 'longer than declared', deflate: true }]), UNCOMPRESSED_SIZE, 4);
        expect(zipErrorCode(() => read(zip))).toBe('damaged');
    });

    test('a local offset past the end', () => {
        const zip = patched(makeZip([{ name: 'a.xml', data: 'text' }]), LOCAL_OFFSET, 0x7fffffff);
        expect(zipErrorCode(() => read(zip))).toBe('damaged');
    });

    test('a local offset that does not point at a local header', () => {
        const zip = patched(makeZip([{ name: 'a.xml', data: 'some text here' }]), LOCAL_OFFSET, 4);
        expect(zipErrorCode(() => read(zip))).toBe('damaged');
    });

    test('data running into the central directory', () => {
        const zip = makeZip([{ name: 'a.xml', data: 'text', deflate: true }]);
        const bad = patched(zip, COMPRESSED_SIZE, onlyEntry(zip).compressedSize + 10);
        expect(zipErrorCode(() => read(bad))).toBe('damaged');
    });

    test('a broken deflate stream', () => {
        const zip = makeZip([{ name: 'a.xml', data: Buffer.from([0xff, 0xff, 0xff, 0xff]), method: 8 }]);
        expect(zipErrorCode(() => read(zip))).toBe('damaged');
    });
});
