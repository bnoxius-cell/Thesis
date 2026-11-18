import classProposalModel from '../models/classProposalModel.js';
import { baseOf, sameBase, readCopy, layerOf, applyToSharedClass, followAgain, closeProposals } from './classChoices.js';
import { actorName, describeEntry } from './timetableChanges.js';
import { notify } from './notify.js';
import { timetableLink } from './appLinks.js';
import { refusal } from './httpErrors.js';

// A member who can't edit a shared timetable proposes the time they customized, and the people who can edit it
// approve or decline (plan 40, 2.5). Approving is the same compare-and-set as an editor's own "Publish my version".

const asText = (id) => String(id._id ?? id);

// Who can decide a proposal: the timetable's owner and its editors.
const editorIds = (schedule) => [asText(schedule.owner), ...schedule.collaborators.filter((c) => c.role === 'editor').map((c) => asText(c.user))];

const tell = ({ recipients, sender, schedule, title, message }) => notify({
    recipients, sender, type: 'schedule_proposal', title, message, link: timetableLink(schedule._id),
});

// A proposal as the client sees it. `stale` is true when the shared class moved (or went) since the proposer
// customized it, so approving it would be refused.
export const publicProposal = (proposal, schedule) => {
    const entry = schedule.entries.find((e) => String(e._id) === String(proposal.entry));
    return {
        _id: String(proposal._id),
        entry: String(proposal.entry),
        title: proposal.title,
        proposer: { _id: asText(proposal.proposer), name: proposal.proposer.name },
        fields: proposal.fields,
        base: proposal.base,
        status: proposal.status,
        stale: !entry || !sameBase(entry, proposal.base),
        createdAt: proposal.createdAt,
    };
};

// Editors see every open proposal on the timetable; anyone else only their own.
export const openProposals = async (schedule, userId, canDecide) => {
    const proposals = await classProposalModel
        .find({ schedule: schedule._id, status: 'open', ...(!canDecide && { proposer: userId }) })
        .populate('proposer', 'name')
        .sort({ createdAt: 1 })
        .lean();
    return proposals.map((proposal) => publicProposal(proposal, schedule));
};

// The proposal `proposalId` on this timetable, whatever its status (null when it isn't on it).
export const findProposal = (schedule, proposalId, extra = {}) => classProposalModel.findOne({ _id: proposalId, schedule: schedule._id, ...extra }).lean();

// "Propose this time to the editors": the member's own copy of the class, as the shared class's new time.
// Returns { proposal } or a refusal.
export const proposeChange = async (userId, schedule, entry, choice) => {
    const copy = await readCopy(userId, choice);
    if (!copy) return refusal("You haven't customized this class.");
    if (!sameBase(entry, choice.base)) return refusal('This class changed since you customized it.', 409);
    const fields = baseOf(copy);
    if (sameBase(entry, fields)) return refusal('Your time is the same as the class already has.');

    let proposal;
    try {
        proposal = await classProposalModel.create({
            schedule: schedule._id, entry: entry._id, title: entry.title, proposer: userId, fields, base: choice.base,
        });
    } catch (error) {
        if (error.code === 11000) return refusal('You already proposed a time for this class.', 409);
        throw error;
    }
    const name = await actorName(userId);
    await tell({
        recipients: editorIds(schedule),
        sender: userId,
        schedule,
        title: `"${schedule.title}": a class change was proposed`,
        message: `${name} proposed a new time for ${describeEntry(entry)}.`,
    });
    return { proposal };
};

// Closes an open proposal with a decision. Null when someone else got there first.
const decide = (proposalId, status, deciderId) => classProposalModel.findOneAndUpdate(
    { _id: proposalId, status: 'open' },
    { status, decidedBy: deciderId, decidedAt: new Date() },
    { returnDocument: 'after' },
);

const tellProposer = async (schedule, proposal, deciderId, verdict) => tell({
    recipients: [proposal.proposer],
    sender: deciderId,
    schedule,
    title: `Your proposal was ${verdict}`,
    message: `${await actorName(deciderId)} ${verdict} your change to ${describeEntry(proposal)}.`,
});

// Approve: the proposed time becomes the class for everyone, as long as the class still is what the proposer
// customized (two editors approving at once: the second finds it moved). Then the proposer follows the class
// again, and hears about it. Returns { conflict: true } when the class moved or is gone.
export const approveProposal = async (schedule, proposal, deciderId) => {
    const entryId = String(proposal.entry);
    const proposer = String(proposal.proposer);
    if (!await applyToSharedClass(schedule, deciderId, entryId, proposal.fields, proposal.base, [proposer])) return { conflict: true };
    await decide(proposal._id, 'approved', deciderId);

    const choice = (await layerOf(proposer, schedule)).byEntry.get(entryId);
    if (choice?.myChoice === 'custom') await followAgain(proposer, schedule, choice, entryId);
    await tellProposer(schedule, proposal, deciderId, 'approved');
    return { conflict: false };
};

// Decline: the proposer keeps their own copy and hears about it. False when it was decided meanwhile.
export const declineProposal = async (schedule, proposal, deciderId) => {
    if (!await decide(proposal._id, 'declined', deciderId)) return false;
    await tellProposer(schedule, proposal, deciderId, 'declined');
    return true;
};

// The proposer takes their own proposal back. False when it was decided meanwhile.
export const withdrawProposal = async (proposal) => (await closeProposals({ _id: proposal._id })).modifiedCount === 1;
