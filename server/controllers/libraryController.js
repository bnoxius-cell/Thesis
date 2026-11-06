// The student's own files (plan 19): the library of General, subject and folder files. Every query
// carries the owner, and every place goes through resolveLocation, so another student's file,
// subject or folder is a 404 and never reaches a link, a move or a delete.
import fileModel from '../models/fileModel.js';
import fileFolderModel from '../models/fileFolderModel.js';
import subjectModel from '../models/subjectModel.js';
import userModel from '../models/userModel.js';
import { fileError, uploadState } from '../utils/fileBudget.js';
import { LocationError, publicFile, resolveLocation } from '../utils/fileLocations.js';
import { getFileLimits } from '../utils/fileLimits.js';
import { sendFileError, sendFileLinks } from '../utils/fileResponse.js';
import { isId } from '../utils/httpErrors.js';
import { activeSubjects } from '../utils/subjectMatch.js';
import { removeFiles, storeFile } from '../utils/storedFiles.js';

const notFound = (res) => res.status(404).json({ success: false, message: 'Not found.' });

// A bad or foreign place answers as its LocationError; everything else is a file error or a fault.
const sendError = (res, error, label) => {
    if (error instanceof LocationError) return res.status(error.status).json({ success: false, message: error.message });
    return sendFileError(res, error, label);
};

const libraryRows = (owner) => ({ owner, scope: 'library' });

// The subject or folder a row points at still exists. An upload or a move can finish just after
// its place was deleted; such a file goes to General instead of pointing at nothing.
const placeExists = (row) => {
    if (row.subject) return subjectModel.exists({ _id: row.subject, owner: row.owner });
    if (row.folder) return fileFolderModel.exists({ _id: row.folder, owner: row.owner });
    return true;
};

const settledInPlace = async (row) => {
    if (await placeExists(row)) return row;
    const general = await fileModel.findOneAndUpdate({ _id: row._id }, { $set: { subject: null, folder: null } }, { returnDocument: 'after' });
    return general ?? row;
};

export const listFiles = async (req, res) => {
    try {
        const where = { ...libraryRows(req.userId), state: 'ready' };
        if (req.query.in !== undefined) Object.assign(where, await resolveLocation(req.userId, req.query.in));

        const [files, subjects, folders, user, uploads] = await Promise.all([
            fileModel.find(where)
                .select('name ext mimeType size width height thumbStorageId subject folder createdAt')
                .sort({ createdAt: -1, _id: -1 })
                .lean(),
            activeSubjects(req.userId).select('name color').lean(),
            fileFolderModel.find({ owner: req.userId }).sort({ nameKey: 1 }).select('name').lean(),
            userModel.findById(req.userId).select('storageUsedBytes').lean(),
            uploadState(),
        ]);
        res.json({
            success: true,
            files: files.map(publicFile),
            locations: {
                subjects: subjects.map(({ _id, name, color }) => ({ id: String(_id), name, color })),
                folders: folders.map(({ _id, name }) => ({ id: String(_id), name })),
            },
            usage: { usedBytes: user?.storageUsedBytes ?? 0, limitBytes: getFileLimits().userStorageBytes },
            uploads,
        });
    } catch (error) {
        sendError(res, error, 'Listing library files failed');
    }
};

// Runs before any limit is spent or body read (the place is in the query string because multer
// hasn't parsed the body yet), and drains the request when it refuses.
export const loadUploadTarget = async (req, res, next) => {
    try {
        req.fileLocation = await resolveLocation(req.userId, req.query.to ?? 'general');
        const held = await fileModel.countDocuments({ ...libraryRows(req.userId), state: { $ne: 'removing' } });
        if (held >= getFileLimits().maxLibraryFiles) throw fileError('too_many_files');
    } catch (error) {
        req.resume();
        return sendError(res, error, 'Checking the upload place failed');
    }
    next();
};

export const uploadFile = async (req, res) => {
    try {
        const row = await storeFile({
            ownerId: req.userId,
            scope: 'library',
            refs: req.fileLocation,
            file: req.upload.file,
            thumb: req.upload.thumb,
        });
        res.status(201).json({ success: true, file: publicFile(await settledInPlace(row)) });
    } catch (error) {
        sendError(res, error, 'Library upload failed');
    }
};

export const getFileLinks = async (req, res) => {
    const { ids, variant } = req.body ?? {};
    if (!Array.isArray(ids) || !ids.length) return notFound(res);
    // Before any query, so a long list can't cost a database read.
    if (ids.length > getFileLimits().maxLinksPerRequest) return sendFileError(res, fileError('too_many'));
    if (!ids.every(isId)) return notFound(res);

    try {
        const found = await fileModel.find({ _id: { $in: ids }, ...libraryRows(req.userId) });
        const byId = new Map(found.map((row) => [String(row._id), row]));
        const rows = ids.map((id) => byId.get(id));
        // One id that isn't this student's library file makes the whole request a 404, nothing reserved.
        if (!rows.every(Boolean)) return notFound(res);
        await sendFileLinks(req, res, rows, { variant });
    } catch (error) {
        sendError(res, error, 'Loading files for links failed');
    }
};

// Moving only changes the ledger row; the stored objects are not touched.
export const moveFile = async (req, res) => {
    try {
        if (!isId(req.params.fileId)) return notFound(res);
        const place = await resolveLocation(req.userId, req.body?.to);
        const moved = await fileModel.findOneAndUpdate(
            { _id: req.params.fileId, ...libraryRows(req.userId), state: 'ready' },
            { $set: place },
            { returnDocument: 'after' },
        );
        if (!moved) return notFound(res);
        res.json({ success: true, file: publicFile(await settledInPlace(moved)) });
    } catch (error) {
        sendError(res, error, 'Moving a library file failed');
    }
};

export const deleteFile = async (req, res) => {
    try {
        const { fileId } = req.params;
        if (!isId(fileId)) return notFound(res);
        const mine = await fileModel.exists({ _id: fileId, ...libraryRows(req.userId), state: { $ne: 'removing' } });
        if (!mine) return notFound(res);
        await removeFiles({ _id: fileId, owner: req.userId });
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, 'Deleting a library file failed');
    }
};
