import mongoose from 'mongoose';

export const FOLDER_LIMITS = { name: 40, maxPerStudent: 20 };

// "Thesis", "Scholarships": a place a student keeps library files in, besides General and their
// subjects. `nameKey` makes names unique per student whatever the case or spacing; it is always
// derived from `name`, never taken from a request.
const fileFolderSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: FOLDER_LIMITS.name },
    nameKey: { type: String, required: true },
}, { timestamps: true });

export const folderNameKey = (name) => name.replace(/\s+/g, ' ').trim().toLowerCase();

fileFolderSchema.pre('validate', function setNameKey() {
    if (typeof this.name === 'string') this.nameKey = folderNameKey(this.name);
});

fileFolderSchema.index({ owner: 1, nameKey: 1 }, { unique: true });

export default mongoose.models.fileFolder || mongoose.model('fileFolder', fileFolderSchema);
