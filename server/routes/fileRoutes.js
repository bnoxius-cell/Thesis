import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getUsage, getDevFile } from '../controllers/fileController.js';
import {
    createFolder, deleteFile, deleteFolder, getFileLinks, listFiles, loadUploadTarget, moveFile, renameFolder, uploadFile,
} from '../controllers/libraryController.js';
import { filesAvailability } from '../utils/fileLimits.js';
import { fileUpload } from '../utils/uploads.js';

const fileRouter = express.Router();

fileRouter.get('/usage', userAuth, getUsage);

// The in-memory store hands out links to this route instead of R2. It is not registered at all in
// production, where links point at the bucket.
if (process.env.NODE_ENV !== 'production' && filesAvailability().store === 'memory') {
    fileRouter.get('/dev/:token', getDevFile);
}

// The student's own files (plan 19). Chat files get their links from the chat routes. Fixed paths
// stay above /:fileId.
fileRouter.post('/links', userAuth, getFileLinks);
fileRouter.get('/', userAuth, listFiles);
fileRouter.post('/', ...fileUpload({ loadParent: loadUploadTarget, requireThumb: false }), uploadFile);
fileRouter.post('/folders', userAuth, createFolder);
fileRouter.patch('/folders/:folderId', userAuth, renameFolder);
fileRouter.delete('/folders/:folderId', userAuth, deleteFolder);
fileRouter.patch('/:fileId', userAuth, moveFile);
fileRouter.delete('/:fileId', userAuth, deleteFile);

export default fileRouter;
