// One-off (plan 34, batch M1): links the class and exam entries of timetables people own to their
// subjects, so "a class is a subject" holds for old data. Dry run by default; uses MONGO_URI from server/.env.
//
//   node scripts/linkClassSubjects.js                       prints per user what it would do, changes nothing
//   node scripts/linkClassSubjects.js --apply               writes
//   node scripts/linkClassSubjects.js --create-missing      also makes subjects for class titles that match none
//   node scripts/linkClassSubjects.js --report <path>       where the report goes (default: the OS temp folder)
//   node scripts/linkClassSubjects.js --undo <report.json>  reverts what an --apply run wrote
//
// A class links to the active subject with the same name or code (courseKey), an exam by whole words in its
// title (same rules as the read-time resolver). Only timetables the user owns are touched. A second run
// finds nothing left to do.
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import scheduleModel from '../models/scheduleModel.js';
import subjectModel, { SUBJECT_LIMITS } from '../models/subjectModel.js';
import taskModel from '../models/taskModel.js';
import reviewerModel from '../models/reviewerModel.js';
import flashcardDeckModel from '../models/flashcardDeckModel.js';
import fileModel from '../models/fileModel.js';
import { activeSubjects, courseKey, entrySubjectFor } from '../utils/subjectMatch.js';
import { createPlannedSubject } from '../controllers/subjectController.js';

const LINKABLE_KINDS = ['class', 'exam'];

const entryRef = (schedule, entry) => ({ scheduleId: String(schedule._id), entryId: String(entry._id), title: entry.title });

// The name a new subject gets: the spelling used most often (the first seen wins a tie).
const mostUsedSpelling = (titles) => {
    const counts = new Map();
    titles.forEach((title) => counts.set(title, (counts.get(title) || 0) + 1));
    return [...counts.entries()].reduce((best, row) => (row[1] > best[1] ? row : best))[0];
};

// Class entries that match no subject, grouped by courseKey in the order first seen.
const groupByCourseKey = (refs) => {
    const groups = new Map();
    refs.forEach((ref) => {
        const key = courseKey(ref.title);
        groups.set(key, [...(groups.get(key) || []), ref]);
    });
    return [...groups.entries()];
};

// One bulk write. The filter only matches entries still unlinked, so a rerun can't overwrite a link.
const writeLinks = (links) => scheduleModel.bulkWrite(links.map((link) => ({
    updateOne: {
        filter: { _id: link.scheduleId },
        update: { $set: { 'entries.$[e].subject': link.subjectId } },
        arrayFilters: [{ 'e._id': new mongoose.Types.ObjectId(link.entryId), 'e.subject': null }],
    },
})));

const linkOwner = async (owner, { apply, createMissing }) => {
    const [schedules, subjects] = await Promise.all([scheduleModel.find({ owner }).lean(), activeSubjects(owner)]);
    const links = [];
    const unmatched = [];
    schedules.forEach((schedule) => schedule.entries.forEach((entry) => {
        if (entry.subject || !LINKABLE_KINDS.includes(entry.kind)) return;
        const subject = entrySubjectFor(entry, subjects);
        if (subject) links.push({ ...entryRef(schedule, entry), subjectId: String(subject._id), subjectName: subject.name });
        else if (entry.kind === 'class') unmatched.push(entryRef(schedule, entry));
    }));

    const created = [];
    const unlinked = [];
    const known = [...subjects];
    for (const [key, group] of groupByCourseKey(unmatched)) {
        let reason = null;
        if (!key) reason = 'no letters or numbers in the title';
        else if (!createMissing) reason = 'no matching subject';
        else if (known.length >= SUBJECT_LIMITS.maxActive) reason = `over the ${SUBJECT_LIMITS.maxActive} subject limit`;

        if (reason) {
            group.forEach((ref) => unlinked.push({ ...ref, reason }));
            continue;
        }
        const name = mostUsedSpelling(group.map((ref) => ref.title));
        const made = apply ? await createPlannedSubject(owner, { name, subjects: known }) : { _id: null, name };
        known.push(made);
        const subjectId = made._id ? String(made._id) : null;
        created.push({ subjectId, name });
        group.forEach((ref) => links.push({ ...ref, subjectId, subjectName: name }));
    }

    if (apply && links.length) await writeLinks(links);
    return { owner: String(owner), links, created, unlinked };
};

export const linkClassSubjects = async ({ apply = false, createMissing = false } = {}) => {
    const users = [];
    for (const owner of await scheduleModel.distinct('owner')) {
        const user = await linkOwner(owner, { apply, createMissing });
        if (user.links.length || user.unlinked.length) users.push(user);
    }
    return { apply, createMissing, users };
};

const hasContent = async (subjectId) => {
    const models = [taskModel, reviewerModel, flashcardDeckModel, fileModel];
    const counts = await Promise.all(models.map((model) => model.countDocuments({ subject: subjectId })));
    return counts.some((n) => n > 0);
};

// Reverts a report written by an --apply run: unsets the links it made, then deletes the subjects it
// created unless they have gained tasks, reviewers, decks or files since.
export const undoLinkClassSubjects = async (report) => {
    if (!report?.apply) throw new Error('That report is from a dry run, so there is nothing to undo.');
    const links = report.users.flatMap((user) => user.links);
    if (links.length) {
        await scheduleModel.bulkWrite(links.map((link) => ({
            updateOne: {
                filter: { _id: link.scheduleId },
                update: { $unset: { 'entries.$[e].subject': '' } },
                arrayFilters: [{
                    'e._id': new mongoose.Types.ObjectId(link.entryId),
                    'e.subject': new mongoose.Types.ObjectId(link.subjectId),
                }],
            },
        })));
    }
    const deleted = [];
    const kept = [];
    for (const subject of report.users.flatMap((user) => user.created)) {
        if (await hasContent(subject.subjectId)) {
            kept.push(subject);
        } else {
            await subjectModel.deleteOne({ _id: subject.subjectId });
            deleted.push(subject);
        }
    }
    return { unlinked: links.length, deleted, kept };
};

const printSummary = ({ apply, users }) => {
    if (!users.length) console.log('Nothing to link.');
    users.forEach((user) => {
        console.log(`User ${user.owner}: ${user.links.length} link(s), ${user.created.length} new subject(s), ${user.unlinked.length} left unlinked.`);
        user.created.forEach((subject) => console.log(`  new subject: ${subject.name}`));
        user.unlinked.forEach((ref) => console.log(`  unlinked: "${ref.title}" (${ref.reason})`));
    });
    if (!apply) console.log('Dry run, nothing written. Run again with --apply to write.');
};

const valueAfter = (flag) => {
    const at = process.argv.indexOf(flag);
    if (at === -1) return null;
    const value = process.argv[at + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a path.`);
    return value;
};

const runFromCommandLine = async () => {
    await import('dotenv/config');
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set in server/.env.');
    }
    const undoPath = valueAfter('--undo');
    const reportPath = valueAfter('--report') || path.join(os.tmpdir(), `link-class-subjects-${Date.now()}.json`);

    await mongoose.connect(process.env.MONGO_URI);
    try {
        if (undoPath) {
            const result = await undoLinkClassSubjects(JSON.parse(fs.readFileSync(undoPath, 'utf8')));
            console.log(`Unlinked ${result.unlinked} entries. Deleted ${result.deleted.length} subject(s), kept ${result.kept.length} that now have content.`);
            return;
        }
        const result = await linkClassSubjects({
            apply: process.argv.includes('--apply'),
            createMissing: process.argv.includes('--create-missing'),
        });
        printSummary(result);
        fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
        console.log(`Report: ${reportPath}`);
    } finally {
        await mongoose.disconnect();
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runFromCommandLine().catch((error) => {
        console.error('Link class subjects failed:', error.message);
        process.exitCode = 1;
    });
}
