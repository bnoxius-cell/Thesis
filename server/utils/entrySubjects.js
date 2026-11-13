import { entrySubjectFor } from './subjectMatch.js';

// A timetable's entries with `subject` rewritten for the person looking: their own subject's id as a
// string, or null. In a timetable they own that is the stored link; anywhere else it is the subject of
// theirs that matches by name. The owner's stored id never leaves the server for anyone else.
// `scheduleLike` is a lean or plain schedule (owner as an id or a populated document).
export const withViewerSubjects = (scheduleLike, viewerId, subjects) => {
    const owned = String(scheduleLike.owner?._id ?? scheduleLike.owner) === String(viewerId);
    return scheduleLike.entries.map((entry) => {
        const subject = entrySubjectFor(entry, subjects, { owned });
        return { ...entry, subject: subject ? String(subject._id) : null };
    });
};
