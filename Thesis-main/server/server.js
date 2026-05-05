import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import User from './models/userModel.js';
import authMiddleware from './middleware/auth.js';
import 'dotenv/config'

let mongoConnected = false;

// init app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(cookieParser());

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database unavailable. Registration is disabled in demo mode.' });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ 
      name, 
      email, 
      password: hashedPassword 
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Demo account
    if (email === 'admin@stresscare.com' && password === 'admin') {
      const demoUser = {
        _id: 'demo',
        name: 'Admin User',
        email: 'admin@stresscare.com',
        authProvider: 'local',
        isAccountVerified: true,
      };
      const token = jwt.sign({ id: demoUser._id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
      });
      return res.json({
        token,
        user: demoUser,
      });
    }

    if (!mongoConnected) {
      return res.status(503).json({ message: 'Database unavailable. Only admin@stresscare.com login is available in demo mode.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    // Optional: set cookie
    res.cookie('token', token, { httpOnly: true, secure: false });

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/profile', authMiddleware, async (req, res) => {
  res.json(req.user);
});

// declare port and connect to db
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        mongoConnected = await connectDB();
    } catch (error) {
        console.warn('Database connection failed. Server will continue in demo mode.');
        mongoConnected = false;
    }

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log('Auth endpoints: POST /api/auth/register, POST /api/auth/login');
        if (!mongoConnected) {
            console.log('Running in demo mode: registration is disabled and only admin@stresscare.com works for login.');
        }
    });
};

startServer();

