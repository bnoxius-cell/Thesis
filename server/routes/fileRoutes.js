import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { getUsage, getDevFile } from '../controllers/fileController.js';
import { filesAvailability } from '../utils/fileLimits.js';

const fileRouter = express.Router();

// Links to files come from the feature that owns them (a group's chat, a subject), never from here.
fileRouter.get('/usage', userAuth, getUsage);

// The in-memory store hands out links to this route instead of R2. It is not registered at all in
// production, where links point at the bucket.
if (process.env.NODE_ENV !== 'production' && filesAvailability().store === 'memory') {
    fileRouter.get('/dev/:token', getDevFile);
}

export default fileRouter;
