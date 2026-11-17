import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    getSubjects, createSubject, getSuggestions, reorderSubjects, getSubject, updateSubject, deleteSubject,
    archiveSubject, restoreSubject, newTerm,
} from '../controllers/subjectController.js';
import { getSubjectSchedule } from '../controllers/scheduleController.js';

const subjectRouter = express.Router();

subjectRouter.get('/', userAuth, getSubjects);
subjectRouter.post('/', userAuth, createSubject);
// Fixed paths go before '/:id' so they aren't read as ids.
subjectRouter.get('/suggestions', userAuth, getSuggestions);
subjectRouter.put('/order', userAuth, reorderSubjects);
subjectRouter.post('/new-term', userAuth, newTerm);
subjectRouter.post('/:id/archive', userAuth, archiveSubject);
subjectRouter.post('/:id/restore', userAuth, restoreSubject);
subjectRouter.get('/:id/schedule', userAuth, getSubjectSchedule);
subjectRouter.get('/:id', userAuth, getSubject);
subjectRouter.patch('/:id', userAuth, updateSubject);
subjectRouter.delete('/:id', userAuth, deleteSubject);

export default subjectRouter;
