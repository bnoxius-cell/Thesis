// The door for every file upload route (plan 18, 3.9). The cheap refusals come first, so a body is
// only read for a signed-in member who is allowed to upload and has room; then multer holds the
// file in memory, and the content checks decide what it really is. The owning route gets the
// checked result in `req.upload` and calls storeFile itself, after its own checks (captions,
// family filter), so nothing is stored for a request it would have refused.
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import userModel from '../models/userModel.js';
import { fileError } from './fileBudget.js';
import { cleanFileName } from './fileNames.js';
import { filesAvailability, getFileLimits } from './fileLimits.js';
import { allowBurst, sendFileError } from './fileResponse.js';
import { detectFileType } from './fileTypes.js';
import { imageInfo } from './imageInfo.js';

// The body is the file and its thumbnail plus multipart framing and a few small fields.
const BODY_HEADROOM_BYTES = 200 * 1024;
const MAX_FIELD_BYTES = 4 * 1024;
const THUMB_TYPES = new Set(['image/jpeg', 'image/webp']);

let slotsInUse = 0;

// For tests: how many uploads hold a slot right now.
export const uploadSlotsInUse = () => slotsInUse;

// Answers before any body is read. The request is drained so the client gets the answer instead of
// a broken connection.
const refuse = (req, res, kind) => {
    req.resume();
    sendFileError(res, fileError(kind));
};

const requireFilesOn = (req, res, next) => (filesAvailability().on ? next() : refuse(req, res, 'files_off'));

const limitBurst = (req, res, next) => {
    if (allowBurst(res, `upload:${req.userId}`, getFileLimits().uploadBurst)) return next();
    req.resume();
};

// Chunked bodies have no length to check up front, so they are refused.
const requireLength = (req, res, next) => {
    const length = Number(req.headers['content-length']);
    if (!Number.isSafeInteger(length) || length <= 0) return refuse(req, res, 'bad_upload');
    if (length > getFileLimits().maxFileBytes + BODY_HEADROOM_BYTES) return refuse(req, res, 'too_big');
    req.uploadLength = length;
    next();
};

// A quick look so an obviously full student isn't read at all. The real, atomic check is
// reserveUserStorage inside storeFile.
const checkRoom = async (req, res, next) => {
    try {
        const user = await userModel.findById(req.userId).select('storageUsedBytes').lean();
        if ((user?.storageUsedBytes ?? 0) + req.uploadLength > getFileLimits().userStorageBytes) return refuse(req, res, 'quota_full');
        next();
    } catch (error) {
        req.resume();
        sendFileError(res, error, 'Checking upload room failed');
    }
};

// A few uploads at a time keep memory bounded on the small server. The slot is held until the
// response is closed (done, failed or aborted), and `once` makes sure it is given back one time.
const takeSlot = (req, res, next) => {
    if (slotsInUse >= getFileLimits().maxConcurrentUploads) return refuse(req, res, 'busy');
    slotsInUse += 1;
    res.once('close', () => { slotsInUse -= 1; });
    next();
};

const parseMultipart = (req, res, next) => {
    const parser = multer({
        storage: multer.memoryStorage(),
        defParamCharset: 'utf8', // browsers send file names as UTF-8
        limits: { fileSize: getFileLimits().maxFileBytes, files: 2, fields: 4, fieldSize: MAX_FIELD_BYTES, parts: 6 },
    }).fields([{ name: 'file', maxCount: 1 }, { name: 'thumb', maxCount: 1 }]);

    parser(req, res, (error) => {
        if (!error) return next();
        const tooBig = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
        sendFileError(res, fileError(tooBig ? 'too_big' : 'bad_upload'));
    });
};

// A photo needs a small JPEG or WebP preview whose header really says so.
const checkedThumb = (part) => {
    if (!part || part.buffer.length > getFileLimits().maxThumbBytes) return null;
    const type = detectFileType(part.buffer, part.originalname);
    if (!type || !THUMB_TYPES.has(type.mimeType) || !imageInfo(part.buffer)) return null;
    return { buffer: part.buffer, mimeType: type.mimeType };
};

// What the file really is comes from its bytes, never from the name or type the browser sent. Every
// image also has its header size read (imageInfo), which refuses a PNG signature in front of other
// bytes and absurd dimensions. A preview sent with a non-image is ignored. A photo's preview is
// required unless the route says it's optional (plan 18, 3.3: subjects can show a type icon); a
// preview that is sent must still pass its checks.
const checkContent = (requireThumb) => (req, res, next) => {
    const part = req.files?.file?.[0];
    if (!part) return sendFileError(res, fileError('bad_upload'));
    const type = detectFileType(part.buffer, part.originalname);
    if (!type) return sendFileError(res, fileError('bad_type'));

    let size = { width: 0, height: 0 };
    let thumb = null;
    if (type.isImage) {
        size = imageInfo(part.buffer);
        if (!size) return sendFileError(res, fileError('bad_type'));
        const thumbPart = req.files.thumb?.[0];
        thumb = checkedThumb(thumbPart);
        if (!thumb && (requireThumb || thumbPart)) return sendFileError(res, fileError('bad_upload'));
    }

    req.upload = {
        file: {
            buffer: part.buffer,
            name: cleanFileName(part.originalname, type.ext),
            ext: type.ext,
            mimeType: type.mimeType,
            width: size.width,
            height: size.height,
        },
        thumb,
        fields: req.body ?? {},
    };
    next();
};

// Middleware for an upload route. `loadParent` finds the group or subject, answers 404 unless the
// student may upload to it, and runs before any limit is spent or body read. `requireThumb: false`
// only for subject files; chat photos always need a preview. Mount it as
// `router.post('/', ...fileUpload({ loadParent }), handler)`.
export const fileUpload = ({ loadParent, requireThumb = true }) => [
    userAuth, loadParent, requireFilesOn, limitBurst, requireLength, checkRoom, takeSlot, parseMultipart, checkContent(requireThumb),
];
