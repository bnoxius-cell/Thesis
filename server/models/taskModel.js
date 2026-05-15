import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        default: '' 
    },
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'user', 
        required: true 
    },
    group: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'group',
        default: null 
    },
    status: { 
        type: String, 
        enum: ['todo', 'in-progress', 'completed'], 
        default: 'todo' 
    },
    dueDate: { type: Date },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
    }
}, { timestamps: true });

export default mongoose.models.task || mongoose.model('task', taskSchema);