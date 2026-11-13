import subjectModel from '../models/subjectModel.js';
import { isId } from './httpErrors.js';

export const PICK_SUBJECT_MESSAGE = 'Pick one of your subjects.';

// "IT 301", "IT-301" and "it301 " all become "it301". The client has the same function in
// client/src/utils/subjectColors.js and a test keeps the two identical. An empty key matches nothing.
export const courseKey = (value) => (
    typeof value === 'string' ? value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : ''
);

// What tasks and reviewers show as their course while linked to the subject.
export const subjectLabel = (subject) => subject.code || subject.name;

export const matchesLabel = (subject, label) => {
    const key = courseKey(label);
    return key !== '' && (courseKey(subject.name) === key || courseKey(subject.code) === key);
};

export const activeSubjects = (owner) => subjectModel.find({ owner, archivedAt: null }).sort({ order: 1, createdAt: 1 });

// Works out which subject a task or reviewer should carry from a request body.
//  - `subject` is an id: it must be the caller's own, active subject (otherwise `error`).
//  - `subject` is null or '': the item is unlinked.
//  - `subject` is missing and `course` was sent: link to the subject whose name or code matches
//    the text, or unlink when none does.
//  - neither was sent: `subject: undefined`, meaning leave the item alone.
export const resolveItemSubject = async (owner, { subject, course }) => {
    if (subject === null || subject === '') return { subject: null };

    if (subject !== undefined) {
        if (!isId(subject)) return { error: PICK_SUBJECT_MESSAGE };
        const found = await subjectModel.findOne({ _id: subject, owner, archivedAt: null });
        return found ? { subject: found } : { error: PICK_SUBJECT_MESSAGE };
    }

    if (course === undefined) return { subject: undefined };
    const subjects = await activeSubjects(owner);
    return { subject: subjects.find((s) => matchesLabel(s, course)) || null };
};

// Writes a resolved subject onto a task or reviewer (a document or a plain update object).
export const applyItemSubject = (target, subject) => {
    if (subject === undefined) return;
    target.subject = subject ? subject._id : null;
    if (subject) target.course = subjectLabel(subject);
};

const words = (text) => (typeof text === 'string' ? text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [] : []);

// How many words of `phrase` sit together, whole, inside `title` (0 when they don't). Whole words only:
// "IT 301" is in "Quiz for IT 301" but "Math" is not in "Mathematics". The client has the same rule in
// client/src/features/details/itemLinks.js and a test keeps the two identical.
export const phraseWordsIn = (title, phrase) => {
    const need = words(phrase);
    if (need.length === 0 || courseKey(phrase).length < 2) return 0;
    const have = words(title);
    for (let from = 0; from + need.length <= have.length; from += 1) {
        if (need.every((word, i) => have[from + i] === word)) return need.length;
    }
    return 0;
};

// The subject whose name or code is in the title as whole words. The longest match wins, so
// "Discrete Math" beats "Math".
export const subjectInTitle = (title, subjects) => {
    let best = null;
    let bestScore = 0;
    for (const subject of subjects) {
        const score = Math.max(phraseWordsIn(title, subject.name), phraseWordsIn(title, subject.code));
        if (score > bestScore) {
            best = subject;
            bestScore = score;
        }
    }
    return best;
};

// The subject (one of `subjects`, the viewer's active ones) a timetable entry belongs to. Only classes and
// exams have one. The stored link counts only in a timetable the viewer owns and only while it is one of
// their active subjects. Otherwise a class matches by name or code, and an exam also by the words in its title.
export const entrySubjectFor = (entry, subjects, { owned = false } = {}) => {
    if (entry.kind !== 'class' && entry.kind !== 'exam') return null;
    if (owned && entry.subject) {
        const stored = subjects.find((s) => String(s._id) === String(entry.subject));
        if (stored) return stored;
    }
    const byLabel = subjects.find((s) => matchesLabel(s, entry.title));
    if (byLabel || entry.kind === 'class') return byLabel || null;
    return subjectInTitle(entry.title, subjects);
};
