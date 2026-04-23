import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import 'dotenv/config'

// init app
const app = express();
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(cookieParser());

// declare port and connect to db
const PORT = process.env.PORT || 5000;
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})