import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        default: ''
    },

    bio: { 
        type: String,
        default: '' 
    },
    program: { 
        type: String, 
        default: 'BS Information Technology' 
    },
    studyHoursPerDay: { 
        type: Number, 
        default: 4 
    },
    sleepHours: { 
        type: Number, 
        default: 7 
    },
    wellbeingGoal: { 
        type: String, 
        enum: ['steady', 'catch-up', 'high-performance'], 
        default: 'steady' 
    },
    friends: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user' 
    }],
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    googleId: {
        type: String,
        sparse: true
    },
    avatar: {
        type: String,
        default: ''
    },
    verifyEmailOtp: {
        type: String,
        default: ''
    },
    verifyEmailOtpExpireAt: {
        type: Number,
        default: 0
    },
    isAccountVerified: {
        type: Boolean,
        default: false
    },
    resetPasswordOtp: {
        type: String,
        default: ''
    },
    resetPasswordOtpExpireAt: {
        type: Number,
        default: 0
    }
}) 

const userModel = mongoose.models.user || mongoose.model('user', userSchema)

export default userModel;