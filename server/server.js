import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import 'dotenv/config'
import authRouter from './routes/authRoutes.js'
import userRouter from './routes/userRoutes.js'

// init app
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

// declare port and connect to db
const PORT = process.env.PORT || 5000;
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})