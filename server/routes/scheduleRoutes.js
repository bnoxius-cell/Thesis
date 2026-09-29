import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    createSchedule, getSchedules, getSchedule, updateSchedule, deleteSchedule,
    addEntry, updateEntry, deleteEntry,
    getHolidays, getWeekOverview, setHolidayOverride,
    shareWithFriend, removeCollaborator, updateShareCode, joinByCode, duplicateSchedule,
} from '../controllers/scheduleController.js';

const scheduleRouter = express.Router();

scheduleRouter.post('/', userAuth, createSchedule);
scheduleRouter.get('/', userAuth, getSchedules);
// Fixed paths go before the /:scheduleId routes so they aren't read as an id.
scheduleRouter.get('/holidays', userAuth, getHolidays);
scheduleRouter.get('/week', userAuth, getWeekOverview);
scheduleRouter.post('/join', userAuth, joinByCode);

scheduleRouter.get('/:scheduleId', userAuth, getSchedule);
scheduleRouter.put('/:scheduleId', userAuth, updateSchedule);
scheduleRouter.delete('/:scheduleId', userAuth, deleteSchedule);

scheduleRouter.post('/:scheduleId/entries', userAuth, addEntry);
scheduleRouter.put('/:scheduleId/entries/:entryId', userAuth, updateEntry);
scheduleRouter.delete('/:scheduleId/entries/:entryId', userAuth, deleteEntry);

scheduleRouter.put('/:scheduleId/holidays', userAuth, setHolidayOverride);

scheduleRouter.post('/:scheduleId/share', userAuth, shareWithFriend);
scheduleRouter.delete('/:scheduleId/share/:userId', userAuth, removeCollaborator);
scheduleRouter.put('/:scheduleId/share-code', userAuth, updateShareCode);
scheduleRouter.post('/:scheduleId/duplicate', userAuth, duplicateSchedule);

export default scheduleRouter;
