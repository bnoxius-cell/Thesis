import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { createTask, getTasks, getTaskByTag, updateTask, deleteTask, importTaskByTag } from '../controllers/taskController.js';

const taskRouter = express.Router();

taskRouter.post('/', userAuth, createTask);
taskRouter.get('/', userAuth, getTasks);
taskRouter.get('/share/:shareTag', userAuth, getTaskByTag);
taskRouter.put('/:taskId', userAuth, updateTask);
taskRouter.delete('/:taskId', userAuth, deleteTask);
taskRouter.post('/import', userAuth, importTaskByTag);

export default taskRouter;
