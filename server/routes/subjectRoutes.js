import express from 'express';
import userAuth from '../middleware/userAuth.js';
import {
    getSubjects, createSubject, getSuggestions, reorderSubjects, getSubject, updateSubject, deleteSubject,
} from '../controllers/subjectController.js';

const subjectRouter = express.Router();

subjectRouter.get('/', userAuth, getSubjects);
subjectRouter.post('/', userAuth, createSubject);
// Fixed paths go before '/:id' so they aren't read as ids.
subjectRouter.get('/suggestions', userAuth, getSuggestions);
subjectRouter.put('/order', userAuth, reorderSubjects);
subjectRouter.get('/:id', userAuth, getSubject);
subjectRouter.patch('/:id', userAuth, updateSubject);
subjectRouter.delete('/:id', userAuth, deleteSubject);

export default subjectRouter;
