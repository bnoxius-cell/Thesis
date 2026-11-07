// Turns a "make a reviewer" request into the text the reviewer is made from (plan 21, 3.3). Three
// kinds of source, exactly one per request: uploaded files, files picked from the student's own
// library, or pasted notes. The cheap refusals all happen in checkSourceRequest, before a stored file
// is read or any text is extracted; loadPickedFiles (and readSources in reviewerSource.js) do the costly part.
import fileModel from '../models/fileModel.js';
import { FileLimitError, fileError } from './fileBudget.js';
import { filesAvailability } from './fileLimits.js';
import { readStoredFiles } from './storedFiles.js';
import {
    MAX_SOURCES, MAX_SOURCES_BYTES, SourceError, cleanNotes, displayName, hashBytes, sourceFingerprint,
    sourceKindOf, sourceTypeOf,
} from './reviewerSource.js';

// Exactly 24 hex characters. Not isId: Mongoose also accepts any 12-character string as an id.
const FILE_ID = /^[a-f0-9]{24}$/i;

// An empty text field counts as not sent, so a form can always include all of them.
const isGiven = (value) => value !== undefined && !(typeof value === 'string' && !value.trim());

// `fileIds` is one comma-separated text field. A repeated field arrives as an array, which is refused.
const parseFileIds = (value) => {
    if (typeof value !== 'string') throw new SourceError('bad_upload');
    const ids = [...new Set(value.split(',').map((id) => id.trim().toLowerCase()).filter(Boolean))];
    if (!ids.length) throw new SourceError('no_source');
    if (ids.length > MAX_SOURCES) throw new SourceError('too_many_files');
    if (!ids.every((id) => FILE_ID.test(id))) throw new SourceError('not_found');
    return ids;
};

// Which kind of source the request holds, with its raw parts. `files` are the uploaded
// [{ buffer, name }]; `body` holds the text fields. Nothing is checked beyond the shape.
export const readSourceRequest = (body, files) => {
    const kinds = [
        ['upload', files.length > 0],
        ['picked', isGiven(body.fileIds)],
        ['notes', isGiven(body.notes)],
    ].filter(([, given]) => given).map(([kind]) => kind);
    if (!kinds.length) throw new SourceError('no_source');
    if (kinds.length > 1) throw new SourceError('many_kinds');

    const [kind] = kinds;
    if (kind === 'upload') return { kind, files };
    if (kind === 'picked') return { kind, ids: parseFileIds(body.fileIds) };
    return { kind, notes: body.notes };
};

const checkUploads = (files) => {
    if (files.length > MAX_SOURCES) throw new SourceError('too_many_files');
    const items = files.map(({ buffer, name }) => ({ buffer, name: displayName(name), bytes: buffer.length, file: null, ...sourceTypeOf(buffer, name) }));
    if (items.reduce((total, item) => total + item.bytes, 0) > MAX_SOURCES_BYTES) throw new SourceError('too_big_together');
    return { kind: 'upload', items, fingerprint: sourceFingerprint('upload', files.map((file) => hashBytes(file.buffer))) };
};

// One query, and only the caller's ready library files can match. Another student's file, a chat
// file, one still uploading or being deleted, and an id that doesn't exist all give the same answer.
const checkPicked = async (ids, userId) => {
    if (!filesAvailability().on) throw fileError('files_off');
    const found = await fileModel.find({ _id: { $in: ids }, owner: userId, scope: 'library', state: 'ready' }).lean();
    const byId = new Map(found.map((row) => [String(row._id), row]));
    if (byId.size !== ids.length) throw new SourceError('not_found');

    const rows = ids.map((id) => byId.get(id));
    for (const row of rows) {
        if (!sourceKindOf(row.ext)) throw new SourceError('bad_type', displayName(row.name));
    }
    if (rows.reduce((total, row) => total + row.size, 0) > MAX_SOURCES_BYTES) throw new SourceError('too_big_together');
    return { kind: 'picked', rows, fingerprint: sourceFingerprint('picked', ids) };
};

const checkNotes = (notes) => {
    const text = cleanNotes(notes);
    return { kind: 'notes', text, fingerprint: sourceFingerprint('notes', [hashBytes(text)]) };
};

// Everything that can be refused without reading a stored file or extracting text. Returns the
// request with its fingerprint (for the double-submit check) and, for the library, the matching rows.
export const checkSourceRequest = (request, userId) => {
    if (request.kind === 'upload') return checkUploads(request.files);
    if (request.kind === 'picked') return checkPicked(request.ids, userId);
    return checkNotes(request.notes);
};

// Reads the picked files from storage, budgeted as links (readStoredFiles), and checks each is what
// its record says it is. A file that can't be read is a plain "try again", not a server error.
export const loadPickedFiles = async (rows, userId) => {
    let buffers;
    try {
        buffers = await readStoredFiles(rows, { userId });
    } catch (error) {
        if (error instanceof FileLimitError && error.code === 'store_failed') throw new SourceError('stored_unreadable');
        throw error;
    }
    return rows.map((row, index) => {
        const name = displayName(row.name);
        const type = sourceTypeOf(buffers[index], row.name);
        if (type.ext !== row.ext) throw new SourceError('damaged', name);
        return { buffer: buffers[index], name, bytes: row.size, file: row._id, ...type };
    });
};

// Pasted notes as a source, shaped like the text read from a file.
export const notesSource = (text) => ({
    kind: 'notes', fileName: '', text, pages: 0, slides: 0, chars: text.length, truncated: false, bytes: Buffer.byteLength(text), file: null,
    read: 'text', picture: null,
});
