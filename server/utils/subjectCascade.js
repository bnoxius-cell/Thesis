import taskModel from '../models/taskModel.js';
import reviewerModel from '../models/reviewerModel.js';
import { matchesLabel, subjectLabel } from './subjectMatch.js';

// Everything that points at a subject today: tasks and reviewers. Later batches (notes, files,
// flashcards) add their model here so deleting or renaming a subject reaches them too.
const LINKED_MODELS = [taskModel, reviewerModel];

// Links the owner's unlinked tasks and reviewers whose course text matches the subject.
// One find per collection, one updateMany by ids. Returns how many of each were linked.
export const linkMatchingItems = async (subject) => {
    const linkIn = async (model) => {
        const unlinked = await model.find({ owner: subject.owner, subject: null }).select('course').lean();
        const ids = unlinked.filter((item) => matchesLabel(subject, item.course)).map((item) => item._id);
        if (ids.length) await model.updateMany({ _id: { $in: ids } }, { $set: { subject: subject._id } });
        return ids.length;
    };
    return { tasks: await linkIn(taskModel), reviewers: await linkIn(reviewerModel) };
};

// After a rename: linked items show the new label.
export const relabelLinkedItems = async (subject) => {
    await Promise.all(LINKED_MODELS.map((model) => (
        model.updateMany({ owner: subject.owner, subject: subject._id }, { $set: { course: subjectLabel(subject) } })
    )));
};

// After a delete: items keep their label text and lose the link.
export const unlinkItems = async (subject) => {
    await Promise.all(LINKED_MODELS.map((model) => (
        model.updateMany({ owner: subject.owner, subject: subject._id }, { $set: { subject: null } })
    )));
};
