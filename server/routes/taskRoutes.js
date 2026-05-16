import express from 'express';
import userAuth from '../middleware/userAuth.js';
import { createTask, getTasks, updateTask, deleteTask } from '../controllers/taskController.js';

const taskRouter = express.Router();

taskRouter.post('/', userAuth, createTask);
taskRouter.get('/', userAuth, getTasks);
taskRouter.put('/:taskId', userAuth, updateTask);
taskRouter.delete('/:taskId', userAuth, deleteTask);

export default taskRouter;