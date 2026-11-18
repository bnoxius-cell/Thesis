import scheduleModel from '../models/scheduleModel.js';
import { roleOf } from './scheduleController.js';
import {
    hasLayer, layerOf, myClassesOf, setChoice, setUp, keepMine, customizeClasses, publishCopy,
} from '../utils/classChoices.js';
import {
    publicProposal, openProposals, findProposal, proposeChange, approveProposal, declineProposal, withdrawProposal,
} from '../utils/classProposals.js';
import { allowPlanWrite } from '../utils/groupPlan.js';
import { isId, serverError } from '../utils/httpErrors.js';

// A member's own layer over a timetable shared with them (plan 40, 2.4): routes under
// /api/schedules/:scheduleId/mine. They only ever change the caller's own choices and timetable; the shared
// timetable is written only by `publish` and by approving a proposal, which are the editors' own actions.

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const CLASS_NOT_FOUND = 'Class not found';

// Loads the shared timetable and the caller's role on it. Sends the error itself and returns null when the
// caller should stop.
const loadShared = async (req, res) => {
    const { scheduleId } = req.params;
    const schedule = isId(scheduleId) ? await scheduleModel.findById(scheduleId).lean() : null;
    const role = schedule && roleOf(schedule, req.userId);
    // 404, not 403, so someone not on it can't tell it exists.
    if (!role) {
        fail(res, 404, 'Schedule not found');
        return null;
    }
    return { schedule, role };
};

// Counts one write against the caller's rate limit. Sends the error itself and returns false when they're over.
const allowWrite = (req, res) => {
    if (allowPlanWrite(req.userId)) return true;
    fail(res, 429, 'Slow down a little.');
    return false;
};

// Loads the shared timetable, the caller's layer on it and, for a class route, the class and the caller's choice
// on it (either may be missing: a class the group removed can still have the caller's choice). Sends the error
// itself and returns null when the caller should stop.
const loadLayer = async (req, res) => {
    const shared = await loadShared(req, res);
    if (!shared) return null;
    const { schedule, role } = shared;
    const { entryId } = req.params;
    if (!hasLayer(schedule, role)) {
        fail(res, 400, "It's your own timetable.");
        return null;
    }
    if (entryId !== undefined && !isId(entryId)) {
        fail(res, 404, CLASS_NOT_FOUND);
        return null;
    }
    if (!allowWrite(req, res)) return null;
    const layer = await layerOf(req.userId, schedule);
    return {
        schedule,
        role,
        layer,
        entry: entryId && schedule.entries.find((e) => String(e._id) === entryId),
        choice: entryId && layer.byEntry.get(entryId),
    };
};

// Every layer route answers with the caller's classes as they are now.
const reply = async (req, res, schedule, status = 200, extra = {}) => res.status(status).json({
    success: true,
    ...extra,
    myClasses: myClassesOf(schedule, await layerOf(req.userId, schedule)),
});

// Turns on the caller's "Count in my week" without touching the timetable's stamp: the group owner's is the
// timetable's own setting, everyone else's is on their collaborator row.
const countInMyWeek = (schedule, role, userId) => (role === 'owner'
    ? scheduleModel.updateOne({ _id: schedule._id }, { $set: { countInWorkload: true } }, { timestamps: false })
    : scheduleModel.updateOne(
        { _id: schedule._id, 'collaborators.user': userId },
        { $set: { 'collaborators.$.countInWorkload': true } },
        { timestamps: false },
    ));

// PUT /:scheduleId/mine/setup  { taking: [entryId] }
// "Which of these do you take?": hides every class not ticked and counts the timetable in the caller's week.
// Ids of classes no longer in the timetable are ignored.
export const setupClasses = async (req, res) => {
    try {
        const { taking } = req.body ?? {};
        if (!Array.isArray(taking) || taking.some((id) => typeof id !== 'string')) return fail(res, 400, 'Pick the classes you take.');
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, role, layer } = loaded;
        await setUp(req.userId, schedule, layer, new Set(taking));
        await countInMyWeek(schedule, role, req.userId);
        await reply(req, res, schedule);
    } catch (error) {
        serverError(res, 'setupClasses error', error);
    }
};

// PUT /:scheduleId/mine/classes/:entryId  { choice: 'follow' | 'hidden' }
// "I take this" or "Not taking this". Following a customized class deletes the caller's copy ("Use the
// group's"); on a class the group removed it is "Remove mine".
export const chooseClass = async (req, res) => {
    try {
        const { choice } = req.body ?? {};
        if (!['follow', 'hidden'].includes(choice)) return fail(res, 400, 'Pick follow or hidden.');
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, layer, entry } = loaded;
        if (!entry && !(choice === 'follow' && loaded.choice?.myChoice === 'custom')) return fail(res, 404, CLASS_NOT_FOUND);
        await setChoice(req.userId, schedule, layer, req.params.entryId, choice);
        await reply(req, res, schedule);
    } catch (error) {
        serverError(res, 'chooseClass error', error);
    }
};

// POST /:scheduleId/mine/classes/:entryId/customize
// "Customize mine": a copy of the class in the caller's own main timetable, linked to their subject (made if
// missing). 201 { scheduleId, entryId } is the copy, for the client to open. A retry answers 200 with the same copy.
export const customizeClass = async (req, res) => {
    try {
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, entry, choice } = loaded;
        if (!entry) return fail(res, 404, CLASS_NOT_FOUND);
        if (choice?.myChoice === 'custom') {
            return reply(req, res, schedule, 200, { scheduleId: choice.copy.scheduleId, entryId: choice.copy.entryId });
        }

        const result = await customizeClasses(req.userId, schedule, [entry]);
        if (result.error) return fail(res, 400, result.error);
        await reply(req, res, schedule, 201, { scheduleId: result.scheduleId, entryId: result.placed.get(req.params.entryId) });
    } catch (error) {
        serverError(res, 'customizeClass error', error);
    }
};

// POST /:scheduleId/mine/customize-all
// "Make it all mine": customizes every class the caller still follows, in one write.
export const customizeAll = async (req, res) => {
    try {
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, layer } = loaded;
        const followed = schedule.entries.filter((e) => e.kind === 'class' && !layer.byEntry.has(String(e._id)));
        if (!followed.length) return reply(req, res, schedule, 200, { customized: 0 });

        const result = await customizeClasses(req.userId, schedule, followed);
        if (result.error) return fail(res, 400, result.error);
        await reply(req, res, schedule, 201, { scheduleId: result.scheduleId, customized: followed.length });
    } catch (error) {
        serverError(res, 'customizeAll error', error);
    }
};

// POST /:scheduleId/mine/classes/:entryId/keep-mine
// Dismisses the change notice on a customized class. On a class the group removed, the copy stays as a plain
// class of the caller's.
export const keepMineClass = async (req, res) => {
    try {
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, layer, entry, choice } = loaded;
        if (!entry && !choice) return fail(res, 404, CLASS_NOT_FOUND);
        if (choice?.myChoice !== 'custom') return fail(res, 400, "You haven't customized this class.");
        await keepMine(req.userId, schedule, layer, req.params.entryId);
        await reply(req, res, schedule);
    } catch (error) {
        serverError(res, 'keepMineClass error', error);
    }
};

// POST /:scheduleId/mine/classes/:entryId/publish
// Editors only: "Publish my version". The caller's copy becomes the class for everyone, as long as the class
// hasn't moved since they customized it (409 otherwise); then they follow it again.
export const publishClass = async (req, res) => {
    try {
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, role, layer, entry, choice } = loaded;
        if (role !== 'owner' && role !== 'editor') return fail(res, 403, 'Only the people who edit this timetable can change it for everyone.');
        if (!entry) return fail(res, 404, CLASS_NOT_FOUND);
        if (choice?.myChoice !== 'custom') return fail(res, 400, "You haven't customized this class.");

        const { conflict } = await publishCopy(req.userId, schedule, layer, req.params.entryId);
        if (conflict) return fail(res, 409, 'This class changed since you customized it.');
        await reply(req, res, schedule);
    } catch (error) {
        serverError(res, 'publishClass error', error);
    }
};

const EDITORS_ONLY = 'Only the people who edit this timetable can decide a proposal.';
const canDecide = (role) => role === 'owner' || role === 'editor';

// POST /:scheduleId/mine/classes/:entryId/propose
// "Propose this time to the editors": for a member who can't change the class for everyone, the time on their own
// copy. One open proposal per class.
export const proposeClass = async (req, res) => {
    try {
        const loaded = await loadLayer(req, res);
        if (!loaded) return;
        const { schedule, role, entry, choice } = loaded;
        if (canDecide(role)) return fail(res, 400, 'You can change this class for everyone yourself.');
        if (!entry) return fail(res, 404, CLASS_NOT_FOUND);
        if (choice?.myChoice !== 'custom') return fail(res, 400, "You haven't customized this class.");

        const { proposal, error, status } = await proposeChange(req.userId, schedule, entry, choice);
        if (error) return fail(res, status, error);
        res.status(201).json({ success: true, proposal: publicProposal(proposal, schedule) });
    } catch (error) {
        serverError(res, 'proposeClass error', error);
    }
};

// GET /:scheduleId/proposals
// The open proposals: all of them for the people who edit the timetable, only their own for anyone else.
export const listProposals = async (req, res) => {
    try {
        const shared = await loadShared(req, res);
        if (!shared) return;
        const { schedule, role } = shared;
        res.json({ success: true, proposals: await openProposals(schedule, req.userId, canDecide(role)) });
    } catch (error) {
        serverError(res, 'listProposals error', error);
    }
};

// Loads the shared timetable and an open proposal on it for a route that decides it (editors only) or withdraws
// it (its proposer only: anyone else's id answers 404). Sends the error itself and returns null when the caller
// should stop.
const loadProposal = async (req, res, { decider }) => {
    const shared = await loadShared(req, res);
    if (!shared) return null;
    if (decider && !canDecide(shared.role)) {
        fail(res, 403, EDITORS_ONLY);
        return null;
    }
    const { proposalId } = req.params;
    const proposal = isId(proposalId) && await findProposal(shared.schedule, proposalId, decider ? {} : { proposer: req.userId });
    if (!proposal) {
        fail(res, 404, 'Proposal not found');
        return null;
    }
    if (proposal.status !== 'open') {
        fail(res, 409, 'This proposal was already closed.');
        return null;
    }
    if (!allowWrite(req, res)) return null;
    return { ...shared, proposal };
};

// POST /:scheduleId/proposals/:proposalId/approve
// Editors only. The proposed time becomes the class for everyone, as long as the class hasn't moved since the
// proposer customized it (409 otherwise; the editor can then decline).
export const approveClassProposal = async (req, res) => {
    try {
        const loaded = await loadProposal(req, res, { decider: true });
        if (!loaded) return;
        const { conflict } = await approveProposal(loaded.schedule, loaded.proposal, req.userId);
        if (conflict) return fail(res, 409, 'This class changed since it was proposed.');
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'approveClassProposal error', error);
    }
};

// POST /:scheduleId/proposals/:proposalId/decline
// Editors only. The proposer keeps their own copy and is told.
export const declineClassProposal = async (req, res) => {
    try {
        const loaded = await loadProposal(req, res, { decider: true });
        if (!loaded) return;
        if (!await declineProposal(loaded.schedule, loaded.proposal, req.userId)) return fail(res, 409, 'This proposal was already closed.');
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'declineClassProposal error', error);
    }
};

// POST /:scheduleId/proposals/:proposalId/withdraw
// The proposer takes their own proposal back.
export const withdrawClassProposal = async (req, res) => {
    try {
        const loaded = await loadProposal(req, res, { decider: false });
        if (!loaded) return;
        if (!await withdrawProposal(loaded.proposal)) return fail(res, 409, 'This proposal was already closed.');
        res.json({ success: true });
    } catch (error) {
        serverError(res, 'withdrawClassProposal error', error);
    }
};
