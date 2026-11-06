import fileModel from '../models/fileModel.js';
import { removeFiles } from './storedFiles.js';

// What deleting a subject or a folder does with the library files inside it (plan 19, 2.6).
// `?files=keep` (the default) moves them to General, `?files=delete` removes them. Anything else,
// including a repeated key (which Express reads as an array), is refused by answering null.
export const filesChoice = (value) => {
    if (value === undefined) return 'keep';
    return value === 'keep' || value === 'delete' ? value : null;
};

// `place` is 'subject' or 'folder'. Call before the place itself is deleted.
export const removePlaceFiles = (place, id, owner) => removeFiles({ [place]: id, owner });

// Call after the place itself is deleted, so an upload that lands late is caught by the re-check
// in libraryController and a straggler can't point at a place that no longer exists.
export const releasePlaceFiles = (place, id, owner) => (
    fileModel.updateMany({ owner, scope: 'library', [place]: id }, { $set: { [place]: null } })
);
