import { describe, test, expect } from 'vitest';
import { imageInfo, MAX_IMAGE_SIDE } from '../utils/imageInfo.js';
import { makePng, makeJpeg, makeWebp } from './helpers/fileFixtures.js';

describe('imageInfo: readable sizes', () => {
    test.each([
        ['png', makePng(640, 480)],
        ['jpeg', makeJpeg(640, 480)],
        ['webp lossy', makeWebp('lossy', 640, 480)],
        ['webp lossless', makeWebp('lossless', 640, 480)],
        ['webp extended', makeWebp('extended', 640, 480)],
    ])('%s', (_label, buffer) => {
        expect(imageInfo(buffer)).toEqual({ width: 640, height: 480 });
    });

    test('the largest allowed side', () => {
        expect(imageInfo(makePng(MAX_IMAGE_SIDE, 4000))).toEqual({ width: MAX_IMAGE_SIDE, height: 4000 });
    });

    test('a JPEG with fill bytes and a standalone marker before the frame header', () => {
        const jpeg = makeJpeg(30, 20);
        const withExtras = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xff, 0xff, 0x01]), jpeg.subarray(2)]);
        expect(imageInfo(withExtras)).toEqual({ width: 30, height: 20 });
    });
});

describe('imageInfo: refused', () => {
    test('a PNG header claiming 50,000 x 50,000', () => {
        const header = makePng(50000, 50000);
        expect(header.length).toBeLessThan(100);
        expect(imageInfo(header)).toBeNull();
    });

    test.each([
        ['png', makePng(MAX_IMAGE_SIDE + 1, 10)],
        ['jpeg', makeJpeg(10, MAX_IMAGE_SIDE + 1)],
        ['webp', makeWebp('extended', MAX_IMAGE_SIDE + 1, 10)],
    ])('a side over the limit: %s', (_label, buffer) => {
        expect(imageInfo(buffer)).toBeNull();
    });

    test('over 40 megapixels with both sides in range', () => {
        expect(imageInfo(makePng(9000, 5000))).toBeNull();
        expect(imageInfo(makePng(8000, 5000))).toEqual({ width: 8000, height: 5000 });
    });

    test('a zero side', () => {
        expect(imageInfo(makePng(0, 100))).toBeNull();
        expect(imageInfo(makeJpeg(100, 0))).toBeNull();
    });

    test('truncated files return null without throwing', () => {
        for (const full of [makePng(), makeJpeg(), makeWebp('lossy'), makeWebp('lossless'), makeWebp('extended')]) {
            for (let length = 0; length < full.length; length++) {
                expect(() => imageInfo(full.subarray(0, length))).not.toThrow();
            }
        }
        expect(imageInfo(makeJpeg().subarray(0, 12))).toBeNull();
    });

    test('a JPEG segment with length zero does not loop', () => {
        const looping = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff, 0xe0, 0x00, 0x00]);
        expect(imageInfo(looping)).toBeNull();
    });

    test('a JPEG that starts the scan before any frame header', () => {
        expect(imageInfo(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x00, 0x00]))).toBeNull();
    });

    test('not an image, or not a buffer', () => {
        expect(imageInfo(Buffer.from('<svg></svg>'))).toBeNull();
        expect(imageInfo(Buffer.alloc(0))).toBeNull();
        expect(imageInfo('not a buffer')).toBeNull();
        expect(imageInfo(undefined)).toBeNull();
    });
});
