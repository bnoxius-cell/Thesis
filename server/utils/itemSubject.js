import { resolveItemSubject } from './subjectMatch.js';
import { planNewSubject, createPlannedSubject } from '../controllers/subjectController.js';

// What a task or deck write says about its subject: an id, a course label, or `newSubject` (a name) to
// make one inline. Answers like resolveItemSubject ({ error } or { subject }), plus { pending } for a name
// no subject of the student's has yet: it is made by finishItemSubject once the rest of the request is
// valid, so a bad request leaves no stray subject. A name that matches a subject (any case, spacing or
// code) reuses it. The owner is always the caller, never anything the browser sent.
export const readItemSubject = async (owner, { subject, course, newSubject }) => {
    if (newSubject === undefined || newSubject === null) return resolveItemSubject(owner, { subject, course });
    const planned = await planNewSubject(owner, newSubject);
    if (planned.error) return { error: planned.error };
    return planned.subject ? { subject: planned.subject } : { pending: planned };
};

// The subject to link, creating the pending one now. Call it after everything else has been checked.
export const finishItemSubject = (owner, link) => (link.pending ? createPlannedSubject(owner, link.pending) : link.subject);
