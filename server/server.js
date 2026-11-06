import 'dotenv/config';
import connectDB from './config/db.js';
import app from './app.js';
import { startReminderJob } from './utils/reminders.js';
import { startFileJob } from './utils/storedFiles.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
        startReminderJob();
        startFileJob();
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
