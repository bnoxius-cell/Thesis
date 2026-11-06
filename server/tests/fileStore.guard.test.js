import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sourceFiles = readdirSync(serverRoot, { recursive: true })
    .map((entry) => entry.split(path.sep).join('/'))
    .filter((entry) => entry.endsWith('.js') && !/(^|\/)(node_modules|tests)\//.test(entry))
    .map((entry) => ({ entry, text: readFileSync(path.join(serverRoot, entry), 'utf8') }));

// r2Usage.js names R2 action types to classify Cloudflare's usage numbers; it makes no R2 call.
const ANALYTICS_NAMES = { HeadObject: ['utils/r2Usage.js'] };

const filesContaining = (needle) => sourceFiles
    .filter(({ text }) => (needle instanceof RegExp ? needle.test(text) : text.includes(needle)))
    .map(({ entry }) => entry);

describe('the R2 store is the only door', () => {
    test('the scan finds the server source', () => {
        expect(filesContaining('r2Store')).toContain('utils/fileStore.js');
    });

    test('only r2Store.js uses aws4fetch', () => {
        expect(filesContaining('aws4fetch')).toEqual(['utils/fileStores/r2Store.js']);
    });

    test.each([
        'ListObjects',
        'list-type=',
        'HeadObject',
        "method: 'HEAD'",
        /[?&]uploads\b/,
        'partNumber',
        'CopyObject',
        'x-amz-copy-source',
        'x-amz-storage-class',
        '@aws-sdk',
        'response-content',
    ])('no server file uses %s', (needle) => {
        expect(filesContaining(needle).filter((entry) => !ANALYTICS_NAMES[needle]?.includes(entry))).toEqual([]);
    });

    test('r2Usage.js only reads Cloudflare analytics, never R2 itself', () => {
        const { text } = sourceFiles.find(({ entry }) => entry === 'utils/r2Usage.js');
        expect(text).not.toContain('cloudflarestorage');
        expect(text.match(/https:\/\/[^\s'`"]+/g)).toEqual(['https://api.cloudflare.com/client/v4/graphql']);
    });

    test("signQuery appears once, next to method: 'GET' inside presignGet", () => {
        expect(filesContaining('signQuery')).toEqual(['utils/fileStores/r2Store.js']);
        const { text } = sourceFiles.find(({ entry }) => entry === 'utils/fileStores/r2Store.js');
        const lines = text.split('\n').filter((line) => line.includes('signQuery'));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("method: 'GET'");
        expect(text.indexOf('signQuery')).toBeGreaterThan(text.indexOf('async presignGet'));
    });
});
