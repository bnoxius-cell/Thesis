import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { createTask, getTasks, updateTask, deleteTask, importTaskByTag } from '../controllers/taskController.js';

const taskRouter = express.Router();

taskRouter.post('/', userAuth, createTask);
taskRouter.get('/', userAuth, getTasks);
taskRouter.put('/:taskId', userAuth, updateTask);
taskRouter.delete('/:taskId', userAuth, deleteTask);
taskRouter.post('/import', userAuth, importTaskByTag);

export default taskRouter;