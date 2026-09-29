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
    joinCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true
    },
    // The owner: made the group, is the only one who can delete it or change roles.
    admin: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true 
    },
    // Extra admins the owner has promoted. They can edit the group and remove regular members.
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    }],
    // Small data-URL picture, '' for none.
    icon: { type: String, default: '' },
    // When on, messages with blocked words are refused (see utils/familyFilter.js).
    familyFriendly: { type: Boolean, default: false },
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