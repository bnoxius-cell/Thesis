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
        required: optional
    },
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