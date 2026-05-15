import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true 
    },
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user' 
    },
    type: { 
        type: String, 
        enum: ['friend_request', 'group_invite', 'task_reminder', 'system'], 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

export default mongoose.models.notification || mongoose.model('notification', notificationSchema);