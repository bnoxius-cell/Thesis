import mongoose from 'mongoose';

export const isId = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

// The real problem goes to the server log. Students get a plain message, never a database error.
export const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ success: false, message: 'Something went wrong on our side. Try again in a moment.' });
};

// A save from a copy that was loaded before someone else changed the document (Mongoose's version check).
export const isStaleSave = (error) => error?.name === 'VersionError';
