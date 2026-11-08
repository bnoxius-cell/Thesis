import express from 'express';
import mongoose from 'mongoose';
import { getFileLimits } from '../utils/fileLimits.js';

const healthRouter = express.Router();

// For uptime monitors: reaches the database (a bare "OK" stays up when Atlas is down) and says
// whether Files is available. Public and secret-free: only up/down and a reason code.
healthRouter.get('/', async (req, res) => {
    let db = 'down';
    try {
        await mongoose.connection.db.admin().ping();
        db = 'up';
    } catch {
        // db stays 'down'
    }
    const { availability } = getFileLimits();
    res.status(db === 'up' ? 200 : 503).json({
        ok: db === 'up',
        db,
        files: availability.on ? 'on' : availability.reason,
    });
});

export default healthRouter;
