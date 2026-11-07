// Photos and scanned PDFs become text with Gemini before any questions are written (plan 21, 3.5): one
// call per picture, a couple at a time. A picture that gives too little text is left out and named in
// a note, as long as the other sources still have enough. The bytes of a picture live only in the
// job's memory and are dropped as soon as its call is done.
import { generateJson } from './gemini.js';
import { friendlyError, describeError } from './aiErrors.js';
import { cleanPageText } from './pdfText.js';
import { TRANSCRIBE_PROMPT, TRANSCRIBE_SCHEMA, TRANSCRIBE_SYSTEM } from './reviewerContent.js';

const AT_ONCE = 2;
// Less than this from one picture and it isn't worth studying.
export const MIN_PICTURE_CHARS = 50;

// A failure while reading pictures whose message is already fit for the student.
export class PictureError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PictureError';
    }
}

// Results in the order of `items`, with at most `limit` calls of `work` running at once.
export const mapLimit = async (items, limit, work) => {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next;
            next += 1;
            results[index] = await work(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

// An answer without the text field is asked again, like any other unusable answer.
const transcribe = async (picture, retry) => {
    const { data } = await retry(async () => {
        const answer = await generateJson({
            system: TRANSCRIBE_SYSTEM, prompt: TRANSCRIBE_PROMPT, schema: TRANSCRIBE_SCHEMA, temperature: 0, files: [picture],
        });
        if (typeof answer.data?.text !== 'string') {
            throw Object.assign(new Error('Gemini answered without the text field.'), { code: 'invalid_output' });
        }
        return answer;
    });
    return cleanPageText(data.text);
};

// The source with its text. A picture that failed carries `failure`, the error its last try ended with.
const readPicture = async (source, retry) => {
    const { picture, ...rest } = source;
    try {
        const text = await transcribe(picture, retry);
        return { ...rest, picture: null, text, chars: text.length, skipped: text.length < MIN_PICTURE_CHARS };
    } catch (error) {
        console.error('Reading a picture failed:', describeError(error));
        return { ...rest, picture: null, text: '', chars: 0, skipped: true, failure: error };
    } finally {
        source.picture = null;
    }
};

// Reads every picture among `sources` (those with `picture` bytes) and returns all sources in the same
// order, the pictures now with text. `retry` wraps one request in the job's retries; `onProgress(done, total)`
// is told after each picture, read or not.
export const transcribeSources = async (sources, { retry, onProgress }) => {
    const pictures = sources.filter((source) => source.picture);
    let done = 0;
    const read = await mapLimit(pictures, AT_ONCE, async (source) => {
        const result = await readPicture(source, retry);
        done += 1;
        await onProgress(done, pictures.length);
        return result;
    });
    const readOf = new Map(pictures.map((source, i) => [source, read[i]]));
    return sources.map((source) => readOf.get(source) ?? source);
};

// Frees whatever picture bytes are still held, for a job that stops early.
export const dropPictures = (sources) => {
    for (const source of sources) source.picture = null;
};

const NOTHING_FOUND = {
    image: "We couldn't find enough text in this photo. Try a clearer, closer photo of your notes.",
    pdf: "We couldn't find enough text in this PDF, even reading the pages as pictures. Try a clearer scan.",
    several: "We couldn't find enough text in these files. Try clearer photos or scans.",
};

// Why a reviewer can't be made after reading: a picture that couldn't be read at all, or too little text.
export const unreadableError = (sources) => {
    const failed = sources.find((source) => source.failure);
    if (failed) return new PictureError(friendlyError(failed.failure, { reading: true }));
    return new PictureError(NOTHING_FOUND[sources.length === 1 ? sources[0].kind : 'several']);
};

// A line for a reviewer that is ready but left some pictures out; '' when none was.
export const skippedNote = (sources) => {
    const pictures = sources.filter((source) => source.read === 'picture');
    const skipped = pictures.filter((source) => source.skipped);
    if (!skipped.length) return '';
    const noun = pictures.every((source) => source.kind === 'image') ? 'photo' : 'file';
    const label = pictures.length === 1 ? noun : `${noun}s`;
    const names = skipped.map((source) => source.fileName).join(', ');
    return `We couldn't read ${skipped.length} of ${pictures.length} ${label} (${names}), so ${skipped.length === 1 ? 'it was' : 'they were'} left out.`;
};
