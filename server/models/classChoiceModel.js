import mongoose from 'mongoose';

// The group's (or friend's) values of a class when a member customized it, or last pressed "Keep mine".
// When the shared class no longer matches, the member is told it moved.
const baseSchema = new mongoose.Schema({
    days: { type: [Number], default: [] },
    date: { type: String, default: '' },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    location: { type: String, default: '' },
    meetingUrl: { type: String, default: '' },
}, { _id: false });

// Where a customized class's own copy lives: an entry in one of the member's personal timetables.
const copySchema = new mongoose.Schema({
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'schedule', required: true },
    entry: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { _id: false });

// One class of the shared timetable the member doesn't simply follow. Following is the absence of a choice,
// so a class an admin adds reaches everyone with no write.
//   hidden  "Not taking this": left out of the member's week
//   custom  "Customize mine": the member has their own copy instead
const choiceSchema = new mongoose.Schema({
    entry: { type: mongoose.Schema.Types.ObjectId, required: true },
    choice: { type: String, enum: ['hidden', 'custom'], required: true },
    copy: { type: copySchema, default: null },
    base: { type: baseSchema, default: null },
}, { _id: false });

// A member's own layer over a timetable shared with them (a group's, or one a friend shared). It is kept apart
// from the shared timetable, so a member's choices never change it, its stamp or its version.
const classChoiceSchema = new mongoose.Schema({
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'schedule', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    // When they answered "Which of these do you take?". Null until then.
    setupAt: { type: Date, default: null },
    choices: { type: [choiceSchema], default: [] },
}, { timestamps: true });

classChoiceSchema.index({ schedule: 1, user: 1 }, { unique: true });
classChoiceSchema.index({ user: 1 });

export default mongoose.models.classChoice || mongoose.model('classChoice', classChoiceSchema);
