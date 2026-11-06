import mongoose from 'mongoose';

// The ledger: one row per stored file, written before anything is sent to the store, so every
// object key is known without listing the bucket (plan 18, 3.3). `bytes` is what the row holds
// against the student's and the server's storage counters until its objects are deleted.
const fileSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    // chat: a group's message. library: the student's own files (General, a subject or a folder), owner only.
    scope: { type: String, enum: ['chat', 'library'], required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'group', default: null },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'groupMessage', default: null },
    // A library file lives in one place: a subject, a folder, or neither (General).
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'subject', default: null },
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'fileFolder', default: null },
    name: { type: String, required: true, maxlength: 140 },
    ext: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 0 },
    // "<store>:<key>". Never sent to a client.
    storageId: { type: String, required: true },
    thumbStorageId: { type: String, default: '' },
    thumbMimeType: { type: String, default: '' },
    thumbSize: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    sha256: { type: String, default: '' },
    state: { type: String, enum: ['uploading', 'ready', 'removing'], default: 'uploading' },
    bytes: { type: Number, required: true, min: 0 },
    removeAttempts: { type: Number, default: 0 },
}, { timestamps: true });

fileSchema.path('folder').validate(
    function inOnePlace(folder) { return !(folder && this.subject); },
    'A file is in a subject or in a folder, not both.',
);

fileSchema.index({ owner: 1 });
fileSchema.index({ group: 1 });
fileSchema.index({ subject: 1 });
fileSchema.index({ folder: 1 });
fileSchema.index({ owner: 1, scope: 1, state: 1, createdAt: -1 });
fileSchema.index({ message: 1 });
fileSchema.index({ state: 1, updatedAt: 1 });
fileSchema.index({ storageId: 1 });

export default mongoose.models.file || mongoose.model('file', fileSchema);
