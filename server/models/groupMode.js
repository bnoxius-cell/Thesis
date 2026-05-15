import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        default: '' 
    },
    admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true 
    },
    members: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user' 
    }],
    recentMessages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        text: { type: String },
        sentAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

export default mongoose.models.group || mongoose.model('group', groupSchema);