import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    createSchedule, getSchedules, getMainSchedule, getSchedule, updateSchedule, deleteSchedule,
    addEntry, addMainEntry, updateEntry, deleteEntry,
    getHolidays, getWeekOverview, previewImport, importSchedule, setHolidayOverride,
    shareWithFriend, removeCollaborator, updateMembership, updateShareCode, joinByCode, duplicateSchedule,
    makePrivate, getScheduleStamp,
} from '../controllers/scheduleController.js';
import {
    setupClasses, chooseClass, customizeClass, customizeAll, keepMineClass, publishClass,
    proposeClass, listProposals, approveClassProposal, declineClassProposal, withdrawClassProposal,
} from '../controllers/classChoiceController.js';

const scheduleRouter = express.Router();

scheduleRouter.post('/', userAuth, createSchedule);
scheduleRouter.get('/', userAuth, getSchedules);
// Fixed paths go before the /:scheduleId routes so they aren't read as an id.
scheduleRouter.get('/main', userAuth, getMainSchedule);
scheduleRouter.post('/main/entries', userAuth, addMainEntry);
scheduleRouter.get('/holidays', userAuth, getHolidays);
scheduleRouter.get('/week', userAuth, getWeekOverview);
scheduleRouter.post('/join', userAuth, joinByCode);
scheduleRouter.post('/preview', userAuth, previewImport);
scheduleRouter.post('/import', userAuth, importSchedule);

scheduleRouter.get('/:scheduleId', userAuth, getSchedule);
scheduleRouter.get('/:scheduleId/stamp', userAuth, getScheduleStamp);
scheduleRouter.put('/:scheduleId', userAuth, updateSchedule);
scheduleRouter.delete('/:scheduleId', userAuth, deleteSchedule);

scheduleRouter.post('/:scheduleId/entries', userAuth, addEntry);
scheduleRouter.put('/:scheduleId/entries/:entryId', userAuth, updateEntry);
scheduleRouter.delete('/:scheduleId/entries/:entryId', userAuth, deleteEntry);

scheduleRouter.put('/:scheduleId/holidays', userAuth, setHolidayOverride);

scheduleRouter.post('/:scheduleId/share', userAuth, shareWithFriend);
scheduleRouter.delete('/:scheduleId/share/:userId', userAuth, removeCollaborator);
scheduleRouter.put('/:scheduleId/membership', userAuth, updateMembership);
scheduleRouter.put('/:scheduleId/share-code', userAuth, updateShareCode);
scheduleRouter.post('/:scheduleId/make-private', userAuth, makePrivate);
scheduleRouter.post('/:scheduleId/duplicate', userAuth, duplicateSchedule);

// The caller's own layer over a timetable shared with them: follow, hide, customize, publish, propose.
scheduleRouter.put('/:scheduleId/mine/setup', userAuth, setupClasses);
scheduleRouter.post('/:scheduleId/mine/customize-all', userAuth, customizeAll);
scheduleRouter.put('/:scheduleId/mine/classes/:entryId', userAuth, chooseClass);
scheduleRouter.post('/:scheduleId/mine/classes/:entryId/customize', userAuth, customizeClass);
scheduleRouter.post('/:scheduleId/mine/classes/:entryId/keep-mine', userAuth, keepMineClass);
scheduleRouter.post('/:scheduleId/mine/classes/:entryId/publish', userAuth, publishClass);
scheduleRouter.post('/:scheduleId/mine/classes/:entryId/propose', userAuth, proposeClass);

// Proposals to change a class of a shared timetable: editors decide, the proposer can withdraw.
scheduleRouter.get('/:scheduleId/proposals', userAuth, listProposals);
scheduleRouter.post('/:scheduleId/proposals/:proposalId/approve', userAuth, approveClassProposal);
scheduleRouter.post('/:scheduleId/proposals/:proposalId/decline', userAuth, declineClassProposal);
scheduleRouter.post('/:scheduleId/proposals/:proposalId/withdraw', userAuth, withdrawClassProposal);

export default scheduleRouter;
