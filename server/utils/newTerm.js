import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
import { cleanEntry, isRealDate } from './entryFields.js';
import { isId, refusal } from './httpErrors.js';
import { activeSubjects, courseKey, matchesLabel } from './subjectMatch.js';
import { archiveSubject, planArchive } from './subjectArchive.js';
import { addClassTimes, planClassTimes } from './subjectClassTimes.js';

// "Start a new term" in one request: archive last term's subjects, add this term's with their class times.
// Everything is checked before the first write, and the writes can be run again (a retry after a failure adds
// nothing twice). Answers { error, status } when it refuses, otherwise { archived, subjects, classTimesAdded, skipped }.

const MAX_NEW_SUBJECTS = 12;
export const MAX_CLASS_TIMES = 6;

// Reads a subject's class times: each one cleaned the way the timetable cleans a class entry, titled with the
// subject's name and starting on `firstDay` (none for a single subject added on its own). Answers
// { classTimes } or { error, status }.
export const readClassTimes = (name, rawTimes, { firstDay = '' } = {}) => {
    const times = rawTimes ?? [];
    if (!Array.isArray(times) || times.length > MAX_CLASS_TIMES) {
        return refusal(`${name} can have up to ${MAX_CLASS_TIMES} class times.`);
    }
    const classTimes = [];
    for (const time of times) {
        const { entry, error } = cleanEntry({
            kind: 'class',
            title: name,
            days: time?.days,
            startTime: time?.startTime,
            endTime: time?.endTime,
            location: time?.location,
            meetingUrl: time?.meetingUrl,
            startDate: firstDay,
        });
        if (error) return refusal(`${name}: ${error}`);
        classTimes.push(entry);
    }
    return { classTimes };
};

// Reads one new subject: its fields (as the subject form checks them) and its class times.
const readSubject = (raw, { term, firstDay }, readFields) => {
    const { fields, error } = readFields({ name: raw?.name, code: raw?.code, term }, { partial: false });
    if (error) return refusal(error);
    const times = readClassTimes(fields.name, raw.classTimes, { firstDay });
    return times.error ? times : { fields, classTimes: times.classTimes };
};

// Reads the whole body without touching the database: { archiveIds, subjects: [{ fields, classTimes }] }.
const readBody = (body, readFields) => {
    const { archive = [], subjects = [], firstDay = '' } = body;
    if (!Array.isArray(archive) || archive.length > SUBJECT_LIMITS.maxActive) {
        return refusal(`Send up to ${SUBJECT_LIMITS.maxActive} subjects to archive, as a list.`);
    }
    if (!Array.isArray(subjects) || subjects.length > MAX_NEW_SUBJECTS) {
        return refusal(`Add up to ${MAX_NEW_SUBJECTS} subjects at a time.`);
    }
    if (firstDay !== '' && !(typeof firstDay === 'string' && isRealDate(firstDay))) {
        return refusal('Pick a real first day of classes.');
    }
    const termField = readFields({ term: body.term }, { partial: true });
    if (termField.error) return refusal(termField.error);

    const read = [];
    const names = new Set();
    for (const raw of subjects) {
        const subject = readSubject(raw, { term: termField.fields.term, firstDay }, readFields);
        if (subject.error) return subject;
        const key = courseKey(subject.fields.name);
        if (key && names.has(key)) return refusal(`${subject.fields.name} is listed twice.`);
        names.add(key);
        read.push(subject);
    }
    if (!archive.every(isId)) return refusal('Subject not found', 404);
    return { archiveIds: [...new Set(archive)], subjects: read };
};

// Checks the request against what the owner has, without writing: the subjects to archive (any of the owner's,
// an archived one is archived again, which is what makes a retry work), which new subjects are already active
// (reused), the subject cap once the archive is done, and room for the class times.
const planNewTerm = async (ownerId, body, readFields) => {
    const read = readBody(body ?? {}, readFields);
    if (read.error) return read;

    const toArchive = await subjectModel.find({ _id: { $in: read.archiveIds }, owner: ownerId });
    if (toArchive.length !== read.archiveIds.length) return refusal('Subject not found', 404);
    for (const subject of toArchive) {
        const plan = await planArchive(ownerId, subject);
        if (plan.error) return plan;
    }

    const leaving = new Set(read.archiveIds);
    const staying = (await activeSubjects(ownerId)).filter((s) => !leaving.has(String(s._id)));
    const subjects = read.subjects.map((subject) => ({ ...subject, existing: staying.find((s) => matchesLabel(s, subject.fields.name)) }));
    const created = subjects.filter((s) => !s.existing).length;
    if (staying.length + created > SUBJECT_LIMITS.maxActive) {
        return refusal(`You can have up to ${SUBJECT_LIMITS.maxActive} subjects. Archive more of last term's first.`);
    }

    // A new subject has no id yet: its position stands in, so the checks can still tell subjects apart.
    const classes = subjects.flatMap((s, index) => s.classTimes.map((time) => ({ ...time, subject: s.existing?._id ?? `new-${index}` })));
    const room = await planClassTimes(ownerId, classes, { dropping: read.archiveIds });
    if (room.error) return refusal(room.error);
    return { toArchive, staying, subjects };
};

// `subjectTools` are the subject controller's own `readFields` and `insertSubject`, so a new term makes
// subjects exactly the way the subject form does.
export const applyNewTerm = async (ownerId, body, subjectTools) => {
    const plan = await planNewTerm(ownerId, body, subjectTools.readFields);
    if (plan.error) return plan;

    let archived = 0;
    for (const subject of plan.toArchive) {
        const result = await archiveSubject(ownerId, subject);
        if (result.error) return result;
        if (!subject.archivedAt) archived += 1;
    }

    const active = [...plan.staying];
    const subjects = [];
    const classes = [];
    for (const { existing, fields, classTimes } of plan.subjects) {
        const subject = existing ?? (await subjectTools.insertSubject(ownerId, fields, active)).subject;
        if (!existing) active.push(subject);
        subjects.push(subject);
        classes.push(...classTimes.map((time) => ({ ...time, subject: subject._id })));
    }
    const placed = await addClassTimes(ownerId, classes);
    if (placed.error) return refusal(placed.error, placed.full ? 400 : 409);
    return { archived, subjects, classTimesAdded: placed.added, skipped: placed.skipped };
};
