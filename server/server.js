import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import 'dotenv/config';
import authRouter from './routes/authRoutes.js';
import userRouter from './routes/userRoutes.js';
import surveyRouter from './routes/surveyRoutes.js';
import taskRouter from './routes/taskRoutes.js';
import friendRouter from './routes/friendRoutes.js';
import groupRouter from './routes/groupRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';

const app = express();
app.use(express.json());

// In dev, Vite auto-bumps to 5174/5175/... whenever something is already holding 5173
// (e.g. a leftover `npm run dev` from a previous session), which would otherwise fail
// CORS against a single hardcoded origin. Allow any localhost port in development;
// production still locks to the single configured CLIENT_URL.
const configuredClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const isDev = process.env.NODE_ENV !== 'production';
const localhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(cors({
    origin: isDev
        ? (origin, callback) => {
            if (!origin || localhostOrigin.test(origin)) return callback(null, true);
            callback(new Error('Not allowed by CORS'));
        }
        : configuredClientUrl,
    credentials: true,
}));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/surveys', surveyRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/friends', friendRouter);
app.use('/api/groups', groupRouter);
app.use('/api/notifications', notificationRouter);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();