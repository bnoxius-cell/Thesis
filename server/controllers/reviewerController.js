import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import reviewerModel from '../models/reviewerModel.js';
import reviewerAttemptModel from '../models/reviewerAttemptModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import { splitIntoParts, MIN_SOURCE_CHARS, PART_CHARS } from '../utils/pdfText.js';
import { generateJson, isGeminiConfigured } from '../utils/gemini.js';
import { withRetries as retrying, friendlyError, describeError } from '../utils/aiErrors.js';
import {
    REVIEWER_SCHEMA, REVIEWER_SYSTEM, TARGETED_SCHEMA, buildReviewerPrompt, buildTargetedPrompt, planParts,
    normalizeReviewer, normalizeTargeted, textForTopics,
    QUESTION_COUNTS, QUESTION_WEIGHTS, DEFAULT_QUESTION_COUNT, FIRST_ROUND_MAX, MIN_QUESTIONS, questionWeight,
    TARGETED_COUNTS, DEFAULT_TARGETED_COUNT, MAX_TARGET_TOPICS, MAX_REVIEWER_QUESTIONS,
} from '../utils/reviewerContent.js';
import { resolveItemSubject, applyItemSubject, subjectLabel } from '../utils/subjectMatch.js';
import { computeProgress, summarizeAttempt, topicStatsFor, scorePercent } from '../utils/reviewerProgress.js';
import { FileLimitError } from '../utils/fileBudget.js';
import { sendFileError, takeBurst } from '../utils/fileResponse.js';
import { getFileLimits } from '../utils/fileLimits.js';
import { extensionOf } from '../utils/fileNames.js';
import { SourceError, combineSources, readSources, sendSourceError, tooLittleTextError } from '../utils/reviewerSource.js';
import { checkSourceRequest, loadPickedFiles, notesSource, readSourceRequest } from '../utils/reviewerIntake.js';
import { WAVES_STOP_AFTER_MS, writeMoreQuestions } from '../utils/reviewerMoreQuestions.js';
import { PictureError, dropPictures, skippedNote, transcribeSources, unreadableError } from '../utils/reviewerPictures.js';

// Everyone shares one Gemini key, so each student gets a few generations a day. A big set of
// questions costs more of them (questionWeight in utils/reviewerContent.js).
export const DAILY_GENERATION_LIMIT = 10;
// Generation runs in the background after the upload answers. If the server restarts in the
// middle, nothing would ever finish it, so a "processing" reviewer is failed once it has gone this long
// without finishing a step (each picture read, each wave of questions). Long enough for one step's
// retries: 4 tries of up to 150s (utils/gemini.js) plus waits.
export const STALE_AFTER_MS = 15 * 60 * 1000;
// Whatever the steps, no run lasts longer than this.
export const MAX_JOB_MS = 45 * 60 * 1000;
// Retries for a busy or flaky AI service. The free tier often answers "high demand" (503) for
// a minute or so, so the last wait is longer. Tests set these to 0.
export const generationSettings = { retryDelaysMs: [4000, 12000, 30000] };

const TITLE_MAX = 120;
const COURSE_MAX = 80;
const OPEN_SESSION_MS = 24 * 60 * 60 * 1000;
// The same source sent again this soon, while the first is still being made, is a double submit.
const DUPLICATE_UPLOAD_MS = 2 * 60 * 1000;
const TOO_LONG = 'This took too long, so we stopped. Try again.';

const NO_TARGETED = { status: 'none', topics: [], count: 0, added: 0, batch: '', jobId: '', requestedAt: null, error: '' };
const NO_PROGRESS = { stage: '', done: 0, total: 0 };

// [5, 10] reads "5 or 10", [10, 15, 20] reads "10, 15 or 20".
const listOf = (numbers) => `${numbers.slice(0, -1).join(', ')} or ${numbers.at(-1)}`;
const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const cleanLine = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Browsers send the file name as UTF-8, but the multipart parser may read it as latin1.
const decodeFileName = (name = '') => {
    if (/[^\u0000-ÿ]/.test(name)) return name;
    const utf8 = Buffer.from(name, 'latin1').toString('utf8');
    return utf8.includes('�') ? name : utf8;
};
const titleFromFileName = (name) => {
    const extension = extensionOf(name);
    const base = extension ? name.slice(0, -(extension.length + 1)) : name;
    return cleanLine(base.replace(/[_]+/g, ' '), TITLE_MAX) || 'Untitled reviewer';
};
const NOTES_TITLE = 'Pasted notes';
const NO_TEXT_TO_REUSE = 'Add the files again to make new questions.';

const parseQuestionCount = (value) => {
    if (value === undefined || value === null || value === '') return DEFAULT_QUESTION_COUNT;
    const count = Number(value);
    return QUESTION_COUNTS.includes(count) ? count : null;
};

// The source as a client sees it. Reviewers made before several sources existed have no type, count
// or list: they read as one PDF. The fingerprint never goes out.
const publicSourceItem = (item) => ({
    type: item.type ?? 'pdf',
    fileName: item.fileName ?? '',
    pages: item.pages ?? 0,
    slides: item.slides ?? 0,
    chars: item.chars ?? 0,
    truncated: Boolean(item.truncated),
});

const publicSource = (r) => {
    const source = r.source ?? {};
    const items = r.sources?.length ? r.sources : [source];
    return {
        ...publicSourceItem(source),
        count: source.count ?? 1,
        items: items.map((item) => ({ ...publicSourceItem(item), skipped: Boolean(item.skipped), fileId: item.file ? String(item.file) : null })),
    };
};

const publicProgress = (r) => ({ stage: r.progress?.stage ?? '', done: r.progress?.done ?? 0, total: r.progress?.total ?? 0 });

const listItem = (r) => ({
    _id: r._id,
    title: r.title,
    course: r.course,
    subject: r.subject ?? null,
    status: r.status,
    error: r.error,
    source: publicSource(r),
    questionTarget: r.questionTarget,
    questionCount: r.questionCount ?? r.questions?.length ?? 0,
    topicCount: r.topicCount ?? r.topics?.length ?? 0,
    version: r.version,
    requestedAt: r.requestedAt,
    generatedAt: r.generatedAt,
    createdAt: r.createdAt,
});

// Questions go out without their answers. Those only come back once a question is answered.
const publicQuestion = (q) => ({ _id: q._id, topic: q.topic, prompt: q.prompt, options: q.options, difficulty: q.difficulty });

const publicTargeted = (t) => ({
    status: t?.status || 'none',
    topics: t?.topics ? [...t.topics] : [],
    count: t?.count || 0,
    added: t?.added || 0,
    error: t?.error || '',
    requestedAt: t?.requestedAt || null,
});

const publicReviewer = (r) => ({
    ...listItem(r),
    aiModel: r.aiModel,
    summary: r.summary,
    keyPoints: r.keyPoints,
    keyTerms: r.keyTerms,
    topics: r.topics.map((t) => ({ name: t.name, summary: t.summary })),
    questionCount: r.questions.length,
    note: r.note ?? '',
    targeted: publicTargeted(r.targeted),
});

// A reviewer that already had questions (version 1 or more) goes back to them when making new
// ones fails. Only a first attempt ends up "failed", with nothing to practise.
// `error` stays on it, so the student is told why the new set didn't come.
const markRunFailed = (filter, error) => reviewerModel.updateMany(
    filter,
    [{ $set: { status: { $cond: [{ $gt: ['$version', 0] }, 'ready', 'failed'] }, error: { $literal: error }, jobId: '', progress: { $literal: NO_PROGRESS } } }],
    { updatePipeline: true },
);

// A run with no step finished lately (the last step, or its start when it has none), or one past the ceiling.
const expireStale = async (filter) => {
    const quiet = new Date(Date.now() - STALE_AFTER_MS);
    const tooOld = new Date(Date.now() - MAX_JOB_MS);
    await markRunFailed({
        ...filter,
        status: 'processing',
        $or: [{ progressAt: { $lt: quiet } }, { progressAt: null, requestedAt: { $lt: quiet } }, { requestedAt: { $lt: tooOld } }],
    }, TOO_LONG);
    await reviewerModel.updateMany(
        { ...filter, 'targeted.status': 'processing', 'targeted.requestedAt': { $lt: quiet } },
        { $set: { 'targeted.status': 'failed', 'targeted.error': TOO_LONG, 'targeted.jobId': '' } },
    );
};

// The real problem goes to the server log. Students get a plain message, never a database error.
const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ success: false, message: 'Something went wrong on our side. Try again in a moment.' });
};

const findOwned = async (req, res, { withText = false } = {}) => {
    const { reviewerId } = req.params;
    if (!isId(reviewerId)) {
        res.status(404).json({ success: false, message: 'Reviewer not found.' });
        return null;
    }
    await expireStale({ _id: reviewerId });
    const query = reviewerModel.findOne({ _id: reviewerId, owner: req.userId });
    const reviewer = await (withText ? query.select('+sourceText') : query);
    if (!reviewer) res.status(404).json({ success: false, message: 'Reviewer not found.' });
    return reviewer;
};

const requestsToday = (userId) => aiRequestModel.countDocuments({
    user: userId,
    at: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
});

// One row per unit of weight (one id each), so the count of rows stays the count of requests used.
const recordRequests = (userId, kind, ids) => aiRequestModel.insertMany(ids.map((_id) => ({ _id, user: userId, kind })));

// Tried twice, so a passing database blip doesn't leave the student charged for nothing.
const deleteRequests = async (ids, tries = 2) => {
    try {
        await aiRequestModel.deleteMany({ _id: { $in: ids } });
    } catch (error) {
        if (tries > 1) return deleteRequests(ids, tries - 1);
        console.error('Refunding AI requests failed:', error);
    }
};

// `work`'s result; when it fails, the reserved requests are given back first.
const refundingOnError = (work, refund) => work.catch(async (error) => {
    await refund();
    throw error;
});

// Takes `weight` of today's limit before the slow part of a request, so two requests at once can't
// both fit in what was left. Returns a refund for a request that ends up not being made, or null
// (with nothing kept) when it doesn't fit. Two at once may both be refused; neither goes over. The
// refund only runs once, however often it is called. The ids are made here, so the refund knows
// every row even when the insert fails part-way.
const reserveRequests = async (userId, kind, weight = 1) => {
    const ids = Array.from({ length: weight }, () => new mongoose.Types.ObjectId());
    let refunded = null;
    const refund = () => (refunded ??= deleteRequests(ids));
    await refundingOnError(recordRequests(userId, kind, ids), refund);
    if (await refundingOnError(requestsToday(userId), refund) <= DAILY_GENERATION_LIMIT) return refund;
    await refund();
    return null;
};

const limitMessage = () => "You've reached today's limit for making reviewers. You can make more tomorrow.";
const notConfigured = (res) => res.status(503).json({ success: false, message: "Reviewers aren't set up on this server yet." });

// ---------------------------------------------------------------------------------------------
// Background generation
// ---------------------------------------------------------------------------------------------

const runningJobs = new Map();
// Lets tests wait for background work instead of polling.
export const settleGenerationJobs = () => Promise.allSettled([...runningJobs.values()]);

// Asks again when the AI service is busy, slow or flaky, or answered with something unusable.
const withRetries = (request) => retrying(request, generationSettings.retryDelaysMs);

const reportProgress = (reviewerId, jobId, progress) => reviewerModel.updateOne(
    { _id: reviewerId, jobId, status: 'processing' },
    { $set: { progress, progressAt: new Date() } },
);

// Photos and scanned PDFs are read into text first (plan 21, 3.5). The text of all the sources is saved
// before any question is written, and the picture bytes and the slot they held are let go as soon as
// the reading is over, whatever way it ends. Returns the text and a note about anything left out, or
// null when this run was replaced, deleted or failed in the meantime (then the reading stops early).
const readPictures = async (reviewer, jobId, { sources, release }) => {
    try {
        const read = await transcribeSources(sources, {
            retry: withRetries,
            onProgress: async (done, total) => (await reportProgress(reviewer._id, jobId, { stage: 'reading', done, total })).matchedCount > 0,
        });
        if (!read) return null;
        const combined = combineSources(read, reviewer.source.fingerprint);
        if (combined.bodyChars < MIN_SOURCE_CHARS) throw unreadableError(read);

        const saved = await reviewerModel.updateOne({ _id: reviewer._id, jobId, status: 'processing' }, {
            $set: {
                source: combined.summary,
                sources: combined.items,
                sourceText: combined.text,
                progress: { stage: 'writing', done: 0, total: 0 },
                progressAt: new Date(),
            },
        });
        return saved.matchedCount ? { text: combined.text, note: skippedNote(read) } : null;
    } finally {
        dropPictures(sources);
        release();
    }
};

// The questions past the first round, from the material and the topics the first round found, and
// whether a failed call or the time limit cut them short. Progress counts questions made so far.
const moreQuestions = async (reviewer, jobId, parts, content) => {
    const target = reviewer.questionTarget;
    const onProgress = (done) => reportProgress(reviewer._id, jobId, { stage: 'writing', done, total: target });
    await onProgress(content.questions.length);
    return writeMoreQuestions({
        title: reviewer.title,
        course: reviewer.course,
        parts,
        topics: content.topics.map((t) => t.name),
        questions: content.questions,
        target,
        retry: withRetries,
        deadline: reviewer.requestedAt.getTime() + WAVES_STOP_AFTER_MS,
        onProgress,
    });
};

// '' unless a set of more than 30 came out short. `interrupted`: a call failed or time ran out, so it
// wasn't the material that ran short.
const shortSetNote = (made, target, interrupted) => {
    if (target <= FIRST_ROUND_MAX || made >= target) return '';
    const why = interrupted ? 'Something went wrong while writing the rest.' : 'There may not be enough material for more.';
    return `We made ${made} of ${target} questions. ${why}`;
};

// Most PDFs are one request. A long one is split into parts that are sent at the same time and
// merged. If any part still fails after its retries, the whole reviewer fails: a reviewer that
// quietly skipped part of the material would be worse than a clear "try again". `pending` holds the
// sources of a reviewer with pictures, which are read before this.
const generate = async (reviewerId, jobId, pending) => {
    const reviewer = await reviewerModel.findOne({ _id: reviewerId, jobId, status: 'processing' }).select('+sourceText');
    if (!reviewer) return;

    try {
        const material = pending ? await readPictures(reviewer, jobId, pending) : { text: reviewer.sourceText, note: '' };
        if (!material) return;
        const parts = splitIntoParts(material.text);
        // Up to 30 questions come with the content, one call per part. More are written after (below).
        const firstRound = Math.min(reviewer.questionTarget, FIRST_ROUND_MAX);
        const plan = planParts(parts.map((p) => p.length), firstRound);

        const settled = await Promise.allSettled(parts.map((text, i) => withRetries(async () => {
            const prompt = buildReviewerPrompt({ title: reviewer.title, course: reviewer.course, text, part: plan[i] });
            const { data, model } = await generateJson({ system: REVIEWER_SYSTEM, prompt, schema: REVIEWER_SCHEMA });
            // Checked on its own first, so a part with unusable questions is asked again.
            normalizeReviewer(data, { questionCount: plan[i].questions, minQuestions: Math.min(MIN_QUESTIONS, plan[i].questions) });
            return { data, model };
        })));
        const failed = settled.find((r) => r.status === 'rejected');
        if (failed) throw failed.reason;

        const answers = settled.map((r) => r.value);
        const { title, ...content } = normalizeReviewer(answers.map((a) => a.data), {
            questionCount: firstRound,
            shares: plan.map((p) => p.questions),
        });
        let interrupted = false;
        if (reviewer.questionTarget > firstRound) {
            const more = await moreQuestions(reviewer, jobId, parts, content);
            content.questions.push(...more.questions);
            interrupted = more.interrupted;
        }
        const saved = await reviewerModel.updateOne(
            { _id: reviewerId, jobId, status: 'processing' },
            {
                $set: {
                    ...content,
                    status: 'ready',
                    error: '',
                    jobId: '',
                    generatedAt: new Date(),
                    aiModel: answers[0].model,
                    note: [material.note, shortSetNote(content.questions.length, reviewer.questionTarget, interrupted)].filter(Boolean).join(' '),
                    progress: NO_PROGRESS,
                    targeted: NO_TARGETED,
                },
                $inc: { version: 1 },
            },
        );
        // A title the student didn't type (the file name) is replaced by the AI's, once.
        // Renaming turns autoTitle off, so a rename made while this ran is kept.
        if (saved.modifiedCount && title) {
            await reviewerModel.updateOne({ _id: reviewerId, autoTitle: true }, { $set: { title, autoTitle: false } });
        }
    } catch (error) {
        console.error('Reviewer generation failed:', describeError(error));
        const message = error instanceof PictureError ? error.message : friendlyError(error);
        await markRunFailed({ _id: reviewerId, jobId, status: 'processing' }, message);
    }
};

// Targeted review: new questions on the topics the student picked, from the same stored text,
// added to the current question set as one batch.
const generateTargeted = async (reviewerId, jobId) => {
    const running = { _id: reviewerId, 'targeted.jobId': jobId, 'targeted.status': 'processing' };
    const reviewer = await reviewerModel.findOne(running).select('+sourceText');
    if (!reviewer) return;

    const topics = [...reviewer.targeted.topics];
    const existing = reviewer.questions.filter((q) => topics.includes(q.topic)).map((q) => q.prompt);
    const prompt = buildTargetedPrompt({
        title: reviewer.title,
        course: reviewer.course,
        text: textForTopics(splitIntoParts(reviewer.sourceText), reviewer.topics, topics, PART_CHARS),
        topics,
        questionCount: reviewer.targeted.count,
        existing,
    });

    try {
        const questions = await withRetries(async () => {
            const { data } = await generateJson({ system: REVIEWER_SYSTEM, prompt, schema: TARGETED_SCHEMA });
            return normalizeTargeted(data, { topics, existing, questionCount: reviewer.targeted.count });
        });
        const batch = randomUUID();
        await reviewerModel.updateOne(
            { ...running, version: reviewer.version },
            {
                $push: { questions: { $each: questions.map((q) => ({ ...q, batch })) } },
                $set: {
                    'targeted.status': 'ready',
                    'targeted.batch': batch,
                    'targeted.added': questions.length,
                    'targeted.jobId': '',
                    'targeted.error': '',
                },
            },
        );
    } catch (error) {
        console.error('Targeted questions failed:', describeError(error));
        await reviewerModel.updateOne(running, {
            $set: { 'targeted.status': 'failed', 'targeted.error': friendlyError(error, { targeted: true }), 'targeted.jobId': '' },
        });
    }
};

const track = (key, work) => {
    const job = work
        .catch((error) => console.error('Reviewer job crashed:', describeError(error)))
        .finally(() => { if (runningJobs.get(key) === job) runningJobs.delete(key); });
    runningJobs.set(key, job);
};
// A reviewer with pictures holds a slot until they are read; the release here is for a run that
// crashes before that. Releasing twice is harmless.
const startGeneration = (reviewerId, jobId, pending = null) =>
    track(String(reviewerId), generate(reviewerId, jobId, pending).finally(() => pending?.release()));
const startTargeted = (reviewerId, jobId) => track(`${reviewerId}:targeted`, generateTargeted(reviewerId, jobId));

// ---------------------------------------------------------------------------------------------
// Reviewers
// ---------------------------------------------------------------------------------------------

// The uploaded files as [{ buffer, name }]. Multer's own copies are dropped, so each buffer can be
// freed once its text is out. `pdf` is the field the old client sends.
const takeUploadedFiles = (req) => {
    const { files = [], pdf = [] } = req.files ?? {};
    req.files = undefined;
    return [...files, ...pdf].map((file) => ({ buffer: file.buffer, name: decodeFileName(file.originalname).slice(0, 200) }));
};

const findDuplicate = (userId, questionTarget, fingerprint) => reviewerModel.findOne({
    owner: userId,
    status: 'processing',
    questionTarget,
    'source.fingerprint': fingerprint,
    createdAt: { $gt: new Date(Date.now() - DUPLICATE_UPLOAD_MS) },
});

// The text of each source, in the order the student chose. Picked files are read from storage here.
const textSources = async (checked, userId) => {
    if (checked.kind === 'notes') return [notesSource(checked.text)];
    return readSources(checked.kind === 'picked' ? await loadPickedFiles(checked.rows, userId) : checked.items);
};

// Cheap refusals first (plan 21, 3.3): nothing is read from storage and nothing is extracted for a
// request that will be turned down, and a double submit costs neither. The day's requests are
// reserved before the slow part and refunded unless a reviewer is made. A student whose other
// reviewer still holds their slot (res.locals.slotHeldElsewhere) only gets a double submit answered:
// anything else is busy_you, and the day is never charged for it.
export const createReviewer = async (req, res) => {
    const busy = Boolean(res.locals.slotHeldElsewhere);
    let refund = null;
    try {
        if (!isGeminiConfigured()) return notConfigured(res);

        const body = req.body ?? {};
        const questionTarget = parseQuestionCount(body.questionCount);
        if (!questionTarget) {
            return res.status(400).json({ success: false, message: `Pick ${listOf(QUESTION_COUNTS)} questions.` });
        }

        const course = cleanLine(body.course, COURSE_MAX);
        const link = await resolveItemSubject(req.userId, { subject: body.subject, course });
        if (link.error) return res.status(400).json({ success: false, message: link.error });

        const request = readSourceRequest(body, takeUploadedFiles(req));

        if (!busy) {
            refund = await reserveRequests(req.userId, 'reviewer', questionWeight(questionTarget));
            if (!refund) return res.status(429).json({ success: false, message: limitMessage() });
        }

        const checked = await checkSourceRequest(request, req.userId);
        // The checked items now hold the only copy of each upload, so readSources can free them one by one.
        request.files = null;
        const duplicate = await findDuplicate(req.userId, questionTarget, checked.fingerprint);
        if (duplicate) {
            await refund?.();
            return res.json({ success: true, reviewer: listItem(duplicate) });
        }
        if (busy) throw new SourceError('busy_you');

        // Reading stored files shares the download burst limit.
        if (checked.kind === 'picked') takeBurst(res, `links:${req.userId}`, getFileLimits().linkBurst);
        const sources = await textSources(checked, req.userId);
        const pictures = sources.filter((source) => source.picture).length;
        const combined = combineSources(sources, checked.fingerprint);
        if (!pictures && combined.bodyChars < MIN_SOURCE_CHARS) throw tooLittleTextError(combined.items);

        const typedTitle = cleanLine(body.title, TITLE_MAX);
        const fallbackTitle = checked.kind === 'notes' ? NOTES_TITLE : titleFromFileName(combined.summary.fileName);
        const jobId = randomUUID();
        const reviewer = await reviewerModel.create({
            owner: req.userId,
            title: typedTitle || fallbackTitle,
            autoTitle: !typedTitle,
            course: link.subject ? subjectLabel(link.subject) : course,
            subject: link.subject?._id ?? null,
            source: combined.summary,
            sources: combined.items,
            // With pictures the text is only known once they are read (readPictures saves it).
            sourceText: pictures ? '' : combined.text,
            questionTarget,
            status: 'processing',
            jobId,
            requestedAt: new Date(),
            progress: pictures ? { stage: 'reading', done: 0, total: pictures } : NO_PROGRESS,
        });
        refund = null;
        // The job keeps the slot (and the picture bytes) after this request has answered.
        startGeneration(reviewer._id, jobId, pictures ? { sources, release: res.locals.keepSlot() } : null);

        res.status(201).json({ success: true, reviewer: listItem(reviewer) });
    } catch (error) {
        // Refunded before the answer, so the student never sees a refused request counted.
        await refund?.();
        if (error instanceof SourceError) return sendSourceError(res, error);
        if (error instanceof FileLimitError) return sendFileError(res, error, 'Create reviewer error');
        serverError(res, 'Create reviewer error', error);
    }
};

export const getReviewers = async (req, res) => {
    try {
        const owner = new mongoose.Types.ObjectId(String(req.userId));
        await expireStale({ owner });
        const reviewers = await reviewerModel.aggregate([
            { $match: { owner } },
            { $sort: { createdAt: -1 } },
            { $addFields: { questionCount: { $size: '$questions' }, topicCount: { $size: '$topics' } } },
            { $project: { sourceText: 0, questions: 0, keyTerms: 0, keyPoints: 0, summary: 0 } },
        ]);

        // Last finished session per reviewer (on its current questions), for the list cards.
        const sessions = await reviewerAttemptModel.aggregate([
            { $match: { user: owner, finishedAt: { $ne: null } } },
            { $sort: { finishedAt: -1 } },
            { $group: { _id: { reviewer: '$reviewer', version: '$version' }, lastScore: { $first: '$score' }, lastAt: { $first: '$finishedAt' }, sessions: { $sum: 1 } } },
        ]);
        const byReviewer = new Map(sessions.map((s) => [`${s._id.reviewer}:${s._id.version}`, s]));

        // Reviewers with an unfinished, not yet fully answered session (same rule as getReviewer).
        const openSessions = await reviewerAttemptModel.aggregate([
            {
                $match: {
                    user: owner,
                    finishedAt: null,
                    createdAt: { $gt: new Date(Date.now() - OPEN_SESSION_MS) },
                    $expr: { $lt: [{ $size: '$answers' }, { $size: '$questions' }] },
                },
            },
            { $group: { _id: { reviewer: '$reviewer', version: '$version' } } },
        ]);
        const hasOpen = new Set(openSessions.map((s) => `${s._id.reviewer}:${s._id.version}`));

        res.json({
            success: true,
            dailyLimit: DAILY_GENERATION_LIMIT,
            weights: QUESTION_WEIGHTS,
            usedToday: await requestsToday(req.userId),
            enabled: isGeminiConfigured(),
            reviewers: reviewers.map((r) => {
                const s = byReviewer.get(`${r._id}:${r.version}`);
                return { ...listItem(r), lastScore: s?.lastScore ?? null, lastStudiedAt: s?.lastAt ?? null, sessions: s?.sessions ?? 0, hasOpenSession: hasOpen.has(`${r._id}:${r.version}`) };
            }),
        });
    } catch (error) {
        serverError(res, 'Get reviewers error', error);
    }
};

export const getReviewer = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;

        const open = await reviewerAttemptModel.findOne({
            reviewer: reviewer._id,
            user: req.userId,
            version: reviewer.version,
            finishedAt: null,
            createdAt: { $gt: new Date(Date.now() - OPEN_SESSION_MS) },
        }).sort({ createdAt: -1 });
        const openSession = open && open.answers.length < open.questions.length
            ? { _id: open._id, mode: open.mode, answered: open.answers.length, total: open.questions.length }
            : null;

        res.json({ success: true, reviewer: publicReviewer(reviewer), openSession });
    } catch (error) {
        serverError(res, 'Get reviewer error', error);
    }
};

export const getReviewerStatus = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;
        res.json({
            success: true,
            status: reviewer.status,
            error: reviewer.error,
            version: reviewer.version,
            progress: publicProgress(reviewer),
            note: reviewer.note ?? '',
            targeted: publicTargeted(reviewer.targeted),
        });
    } catch (error) {
        serverError(res, 'Reviewer status error', error);
    }
};

export const updateReviewer = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;
        if (req.body.title !== undefined) {
            const title = cleanLine(req.body.title, TITLE_MAX);
            if (!title) return res.status(400).json({ success: false, message: 'Give the reviewer a title.' });
            reviewer.title = title;
            reviewer.autoTitle = false;
        }
        const course = req.body.course === undefined ? undefined : cleanLine(req.body.course, COURSE_MAX);
        const link = await resolveItemSubject(req.userId, { subject: req.body.subject, course });
        if (link.error) return res.status(400).json({ success: false, message: link.error });
        if (course !== undefined) reviewer.course = course;
        applyItemSubject(reviewer, link.subject);
        await reviewer.save();
        res.json({ success: true, reviewer: listItem(reviewer) });
    } catch (error) {
        serverError(res, 'Update reviewer error', error);
    }
};

// Makes a fresh set of content from the stored text: a retry after a failure, or new questions.
export const regenerateReviewer = async (req, res) => {
    try {
        if (!isGeminiConfigured()) return notConfigured(res);
        const reviewer = await findOwned(req, res, { withText: true });
        if (!reviewer) return;
        if (reviewer.status === 'processing') {
            return res.status(409).json({ success: false, message: 'This reviewer is still being made.' });
        }
        if (reviewer.targeted?.status === 'processing') {
            return res.status(409).json({ success: false, message: 'Wait for the extra questions to finish first.' });
        }
        if (!reviewer.sourceText) {
            return res.status(409).json({ success: false, message: NO_TEXT_TO_REUSE });
        }
        const questionTarget = req.body.questionCount === undefined ? reviewer.questionTarget : parseQuestionCount(req.body.questionCount);
        if (!questionTarget) {
            return res.status(400).json({ success: false, message: `Pick ${listOf(QUESTION_COUNTS)} questions.` });
        }
        const refund = await reserveRequests(req.userId, 'reviewer', questionWeight(questionTarget));
        if (!refund) return res.status(429).json({ success: false, message: limitMessage() });

        const jobId = randomUUID();
        Object.assign(reviewer, { status: 'processing', error: '', jobId, requestedAt: new Date(), progressAt: null, note: '', questionTarget });
        await refundingOnError(reviewer.save(), refund);
        startGeneration(reviewer._id, jobId);

        res.json({ success: true, reviewer: listItem(reviewer) });
    } catch (error) {
        serverError(res, 'Regenerate reviewer error', error);
    }
};

// Targeted review: the student picks up to three topics (the app ticks their weak ones) and
// asks for a few new questions on them. Only runs when asked; viewing results never calls the AI.
export const requestTargeted = async (req, res) => {
    try {
        if (!isGeminiConfigured()) return notConfigured(res);
        const reviewer = await findOwned(req, res, { withText: true });
        if (!reviewer) return;
        if (reviewer.status !== 'ready') {
            return res.status(409).json({ success: false, message: "This reviewer isn't ready yet." });
        }
        if (reviewer.targeted?.status === 'processing') {
            return res.status(409).json({ success: false, message: 'New questions are already on the way.' });
        }
        if (!reviewer.sourceText) {
            return res.status(409).json({ success: false, message: NO_TEXT_TO_REUSE });
        }

        const known = new Set(reviewer.topics.map((t) => t.name));
        const topics = Array.isArray(req.body.topics) ? [...new Set(req.body.topics.filter((t) => typeof t === 'string'))] : [];
        if (!topics.length || topics.length > MAX_TARGET_TOPICS) {
            return res.status(400).json({ success: false, message: `Pick one to ${MAX_TARGET_TOPICS} topics.` });
        }
        if (topics.some((t) => !known.has(t))) {
            return res.status(400).json({ success: false, message: 'Pick topics from this reviewer.' });
        }
        const count = req.body.questionCount === undefined ? DEFAULT_TARGETED_COUNT : Number(req.body.questionCount);
        if (!TARGETED_COUNTS.includes(count)) {
            return res.status(400).json({ success: false, message: `Pick ${listOf(TARGETED_COUNTS)} questions.` });
        }
        const room = MAX_REVIEWER_QUESTIONS - reviewer.questions.length;
        if (room < Math.min(...TARGETED_COUNTS)) {
            return res.status(409).json({
                success: false,
                message: `This reviewer already has ${reviewer.questions.length} questions, the most it can hold. Use New questions to start a fresh set.`,
            });
        }
        const refund = await reserveRequests(req.userId, 'targeted');
        if (!refund) return res.status(429).json({ success: false, message: limitMessage() });

        const jobId = randomUUID();
        reviewer.targeted = { ...NO_TARGETED, status: 'processing', topics, count: Math.min(count, room), jobId, requestedAt: new Date() };
        await refundingOnError(reviewer.save(), refund);
        startTargeted(reviewer._id, jobId);

        res.status(202).json({ success: true, targeted: publicTargeted(reviewer.targeted) });
    } catch (error) {
        serverError(res, 'Targeted questions error', error);
    }
};

export const deleteReviewer = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;
        await reviewerAttemptModel.deleteMany({ reviewer: reviewer._id });
        await reviewer.deleteOne();
        res.json({ success: true, message: 'Reviewer deleted.' });
    } catch (error) {
        serverError(res, 'Delete reviewer error', error);
    }
};

// ---------------------------------------------------------------------------------------------
// Learning Mode
// ---------------------------------------------------------------------------------------------

const shuffled = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};

const finishedSessions = (reviewer, userId) =>
    reviewerAttemptModel.find({ reviewer: reviewer._id, user: userId, finishedAt: { $ne: null } }).sort({ finishedAt: -1 });

const answerResult = (question, answer) => ({
    questionId: question._id,
    choice: answer.choice,
    correct: answer.correct,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
});

const sessionPayload = (attempt, reviewer) => {
    const byId = new Map(reviewer.questions.map((q) => [String(q._id), q]));
    const questions = attempt.questions.map((id) => byId.get(String(id))).filter(Boolean);
    return {
        _id: attempt._id,
        mode: attempt.mode,
        total: questions.length,
        finishedAt: attempt.finishedAt,
        questions: questions.map(publicQuestion),
        answers: attempt.answers
            .map((a) => (byId.has(String(a.question)) ? answerResult(byId.get(String(a.question)), a) : null))
            .filter(Boolean),
    };
};

// Ends a session and scores it. The score comes only from the answers graded and stored here,
// never from anything the browser sends. Closing first means no answer can be added after the
// score is worked out. Safe to call twice: the second call just reads the closed session.
const closeAttempt = async (attempt, reviewer) => {
    const closed = await reviewerAttemptModel.findOneAndUpdate(
        { _id: attempt._id, finishedAt: null },
        { $set: { finishedAt: new Date() } },
        { returnDocument: 'after' },
    );
    if (!closed) return reviewerAttemptModel.findById(attempt._id);
    const correct = closed.answers.filter((a) => a.correct).length;
    const answered = closed.answers.length;
    return reviewerAttemptModel.findByIdAndUpdate(closed._id, {
        $set: {
            correct,
            answered,
            total: closed.questions.length,
            score: scorePercent(correct, answered),
            topicStats: topicStatsFor(reviewer.questions, closed.answers),
        },
    }, { returnDocument: 'after' });
};

// Loads the reviewer and one of the caller's sessions on it, or answers with the reason not.
const loadSession = async (req, res) => {
    const reviewer = await findOwned(req, res);
    if (!reviewer) return {};
    const { sessionId } = req.params;
    const attempt = isId(sessionId)
        ? await reviewerAttemptModel.findOne({ _id: sessionId, reviewer: reviewer._id, user: req.userId })
        : null;
    if (!attempt) {
        res.status(404).json({ success: false, message: 'Session not found.' });
        return {};
    }
    if (attempt.version !== reviewer.version) {
        res.status(409).json({ success: false, message: 'This reviewer has new questions now. Start a new session.' });
        return {};
    }
    return { reviewer, attempt };
};

export const startSession = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;
        if (reviewer.status !== 'ready' || !reviewer.questions.length) {
            return res.status(409).json({ success: false, message: "This reviewer isn't ready yet." });
        }

        const mode = ['weak', 'targeted'].includes(req.body.mode) ? req.body.mode : 'all';
        let pool = reviewer.questions;
        if (mode === 'weak') {
            const progress = computeProgress(reviewer, await finishedSessions(reviewer, req.userId));
            const weak = new Set(progress.weakTopics);
            pool = pool.filter((q) => weak.has(q.topic));
            if (!pool.length) {
                return res.status(400).json({ success: false, message: 'No weak topics right now. Finish a full session first.' });
            }
        }
        if (mode === 'targeted') {
            const batch = reviewer.targeted?.status === 'ready' ? reviewer.targeted.batch : '';
            pool = batch ? pool.filter((q) => q.batch === batch) : [];
            if (!pool.length) {
                return res.status(400).json({ success: false, message: 'There are no new questions to practice yet.' });
            }
        }

        const attempt = await reviewerAttemptModel.create({
            user: req.userId,
            reviewer: reviewer._id,
            version: reviewer.version,
            mode,
            questions: shuffled(pool.map((q) => q._id)),
            total: pool.length,
        });
        res.status(201).json({ success: true, session: sessionPayload(attempt, reviewer) });
    } catch (error) {
        serverError(res, 'Start session error', error);
    }
};

export const getSession = async (req, res) => {
    try {
        const { reviewer, attempt } = await loadSession(req, res);
        if (!attempt) return;
        res.json({ success: true, session: sessionPayload(attempt, reviewer) });
    } catch (error) {
        serverError(res, 'Get session error', error);
    }
};

export const answerQuestion = async (req, res) => {
    try {
        const { reviewer, attempt } = await loadSession(req, res);
        if (!attempt) return;

        const { questionId, choice } = req.body;
        if (!isId(questionId) || !attempt.questions.some((id) => String(id) === String(questionId))) {
            return res.status(400).json({ success: false, message: "That question isn't part of this session." });
        }
        if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
            return res.status(400).json({ success: false, message: 'Pick one of the four answers.' });
        }
        const question = reviewer.questions.id(questionId);
        if (!question) return res.status(400).json({ success: false, message: "That question isn't part of this session." });

        // The first answer counts. A double click or a retry gets the same result back, even
        // after the last answer closed the session.
        const isThis = (a) => String(a.question) === String(question._id);
        let current = attempt;
        if (!attempt.answers.some(isThis)) {
            if (attempt.finishedAt) return res.status(409).json({ success: false, message: 'This session is already over.' });
            const answer = { question: question._id, choice, correct: choice === question.correctIndex, answeredAt: new Date() };
            current = await reviewerAttemptModel.findOneAndUpdate(
                { _id: attempt._id, finishedAt: null, 'answers.question': { $ne: question._id } },
                { $push: { answers: answer } },
                { returnDocument: 'after' },
            ) || await reviewerAttemptModel.findById(attempt._id);
        }
        const recorded = current.answers.find(isThis);
        if (!recorded) return res.status(409).json({ success: false, message: 'This session is already over.' });

        // The last answer closes the session, so leaving or refreshing before the results page
        // doesn't lose it.
        if (!current.finishedAt && current.answers.length >= current.questions.length) {
            await closeAttempt(current, reviewer);
        }

        res.json({
            success: true,
            result: answerResult(question, recorded),
            answered: current.answers.length,
            total: current.questions.length,
        });
    } catch (error) {
        serverError(res, 'Answer question error', error);
    }
};

export const finishSession = async (req, res) => {
    try {
        const { reviewer, attempt } = await loadSession(req, res);
        if (!attempt) return;

        let finished = attempt;
        if (!attempt.finishedAt) {
            if (!attempt.answers.length) {
                // Nothing answered: there's nothing to learn from, so don't keep it.
                await reviewerAttemptModel.deleteOne({ _id: attempt._id, finishedAt: null, answers: { $size: 0 } });
                return res.json({ success: true, session: null });
            }
            finished = await closeAttempt(attempt, reviewer);
        }

        const byId = new Map(reviewer.questions.map((q) => [String(q._id), q]));
        const review = finished.answers
            .map((a) => {
                const q = byId.get(String(a.question));
                return q ? { ...publicQuestion(q), ...answerResult(q, a) } : null;
            })
            .filter(Boolean);
        const progress = computeProgress(reviewer, await finishedSessions(reviewer, req.userId));

        res.json({
            success: true,
            session: { ...summarizeAttempt(finished), topicStats: finished.topicStats },
            review,
            progress,
        });
    } catch (error) {
        serverError(res, 'Finish session error', error);
    }
};

export const getProgress = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;
        const sessions = await finishedSessions(reviewer, req.userId);
        res.json({
            success: true,
            progress: computeProgress(reviewer, sessions),
            history: sessions.slice(0, 30).map(summarizeAttempt),
        });
    } catch (error) {
        serverError(res, 'Get progress error', error);
    }
};
