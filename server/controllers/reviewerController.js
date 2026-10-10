import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import reviewerModel from '../models/reviewerModel.js';
import reviewerAttemptModel from '../models/reviewerAttemptModel.js';
import aiRequestModel from '../models/aiRequestModel.js';
import { extractPdfText, isPdfBuffer, MIN_SOURCE_CHARS } from '../utils/pdfText.js';
import { generateJson, isGeminiConfigured } from '../utils/gemini.js';
import {
    REVIEWER_SCHEMA, REVIEWER_SYSTEM, buildReviewerPrompt, normalizeReviewer,
    QUESTION_COUNTS, DEFAULT_QUESTION_COUNT,
} from '../utils/reviewerContent.js';
import { computeProgress, summarizeAttempt, topicStatsFor, scorePercent } from '../utils/reviewerProgress.js';

// Everyone shares one Gemini key, so each student gets a few generations a day.
export const DAILY_GENERATION_LIMIT = 10;
// Generation runs in the background after the upload answers. If the server restarts in the
// middle, nothing would ever finish it, so anything still "processing" after this is failed.
export const STALE_AFTER_MS = 6 * 60 * 1000;
// Retries for a busy or flaky AI service. Tests set these to 0.
export const generationSettings = { retryDelaysMs: [4000, 12000] };

const TITLE_MAX = 120;
const COURSE_MAX = 80;
const OPEN_SESSION_MS = 24 * 60 * 60 * 1000;
const TOO_LONG = 'This took too long, so we stopped. Try again.';

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const cleanLine = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Browsers send the file name as UTF-8, but the multipart parser may read it as latin1.
const decodeFileName = (name = '') => {
    if (/[^\u0000-ÿ]/.test(name)) return name;
    const utf8 = Buffer.from(name, 'latin1').toString('utf8');
    return utf8.includes('�') ? name : utf8;
};
const titleFromFileName = (name) => cleanLine(name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '), TITLE_MAX) || 'Untitled reviewer';

const parseQuestionCount = (value) => {
    if (value === undefined || value === null || value === '') return DEFAULT_QUESTION_COUNT;
    const count = Number(value);
    return QUESTION_COUNTS.includes(count) ? count : null;
};

const listItem = (r) => ({
    _id: r._id,
    title: r.title,
    course: r.course,
    status: r.status,
    error: r.error,
    source: r.source,
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

const publicReviewer = (r) => ({
    ...listItem(r),
    aiModel: r.aiModel,
    summary: r.summary,
    keyPoints: r.keyPoints,
    keyTerms: r.keyTerms,
    topics: r.topics,
    questionCount: r.questions.length,
});

const expireStale = (filter) => reviewerModel.updateMany(
    { ...filter, status: 'processing', requestedAt: { $lt: new Date(Date.now() - STALE_AFTER_MS) } },
    { $set: { status: 'failed', error: TOO_LONG, jobId: '' } },
);

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

const limitMessage = () => `You've made ${DAILY_GENERATION_LIMIT} reviewers in the last 24 hours. You can make more tomorrow.`;
const notConfigured = (res) => res.status(503).json({ success: false, message: "Reviewers aren't set up on this server yet." });

// ---------------------------------------------------------------------------------------------
// Background generation
// ---------------------------------------------------------------------------------------------

const runningJobs = new Map();
// Lets tests wait for background work instead of polling.
export const settleGenerationJobs = () => Promise.allSettled([...runningJobs.values()]);

const isRetryable = (error) =>
    error?.code === 'invalid_output' || error?.status === 429 || (error?.status >= 500 && error?.status < 600);

const friendlyError = (error) => {
    if (error?.code === 'invalid_output') return "We couldn't get good questions out of this PDF. Try again, or try a PDF with more text.";
    if (error?.status === 429) return 'The AI service is busy right now. Try again in a few minutes.';
    if (error?.status >= 500) return 'The AI service had a problem. Try again in a bit.';
    if (error?.status === 400) return "The AI service couldn't work with this material. Try a different PDF.";
    if (/timed? ?out|abort/i.test(error?.message || '')) return 'The AI took too long to answer. Try again, or try a shorter PDF.';
    return "We couldn't make this reviewer. Try again.";
};

const generate = async (reviewerId, jobId) => {
    const reviewer = await reviewerModel.findOne({ _id: reviewerId, jobId, status: 'processing' }).select('+sourceText');
    if (!reviewer) return;

    const prompt = buildReviewerPrompt({
        title: reviewer.title,
        course: reviewer.course,
        text: reviewer.sourceText,
        questionCount: reviewer.questionTarget,
    });

    let lastError;
    const { retryDelaysMs } = generationSettings;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        try {
            const { data, model } = await generateJson({ system: REVIEWER_SYSTEM, prompt, schema: REVIEWER_SCHEMA });
            const content = normalizeReviewer(data, { questionCount: reviewer.questionTarget });
            await reviewerModel.updateOne(
                { _id: reviewerId, jobId, status: 'processing' },
                {
                    $set: { ...content, status: 'ready', error: '', jobId: '', generatedAt: new Date(), aiModel: model },
                    $inc: { version: 1 },
                },
            );
            return;
        } catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === retryDelaysMs.length) break;
            await sleep(retryDelaysMs[attempt]);
        }
    }

    console.error('Reviewer generation failed:', lastError?.status || '', lastError?.message);
    await reviewerModel.updateOne(
        { _id: reviewerId, jobId, status: 'processing' },
        { $set: { status: 'failed', error: friendlyError(lastError), jobId: '' } },
    );
};

const startGeneration = (reviewerId, jobId) => {
    const key = String(reviewerId);
    const job = generate(reviewerId, jobId)
        .catch((error) => console.error('Reviewer generation crashed:', error.message))
        .finally(() => { if (runningJobs.get(key) === job) runningJobs.delete(key); });
    runningJobs.set(key, job);
};

// ---------------------------------------------------------------------------------------------
// Reviewers
// ---------------------------------------------------------------------------------------------

export const createReviewer = async (req, res) => {
    try {
        if (!isGeminiConfigured()) return notConfigured(res);

        const file = req.file;
        if (!file) return res.status(400).json({ success: false, message: 'Choose a PDF to upload.' });
        if (!isPdfBuffer(file.buffer)) return res.status(400).json({ success: false, message: "That file isn't a PDF." });

        const questionTarget = parseQuestionCount(req.body.questionCount);
        if (!questionTarget) {
            return res.status(400).json({ success: false, message: `Pick ${QUESTION_COUNTS.join(', ')} questions.` });
        }

        if (await requestsToday(req.userId) >= DAILY_GENERATION_LIMIT) {
            return res.status(429).json({ success: false, message: limitMessage() });
        }

        let extracted;
        try {
            extracted = await extractPdfText(file.buffer);
        } catch (error) {
            const message = error?.name === 'PasswordException'
                ? 'This PDF is password protected. Remove the password and upload it again.'
                : "We couldn't read this PDF. It may be damaged.";
            return res.status(422).json({ success: false, message });
        }
        if (extracted.text.length < MIN_SOURCE_CHARS) {
            return res.status(422).json({
                success: false,
                message: "This PDF doesn't have enough text to make a reviewer. Scanned pages and image-only slides can't be read yet.",
            });
        }

        const fileName = decodeFileName(file.originalname);
        const jobId = randomUUID();
        const reviewer = await reviewerModel.create({
            owner: req.userId,
            title: cleanLine(req.body.title, TITLE_MAX) || titleFromFileName(fileName),
            course: cleanLine(req.body.course, COURSE_MAX),
            source: { fileName: fileName.slice(0, 200), pages: extracted.pages, chars: extracted.chars, truncated: extracted.truncated },
            sourceText: extracted.text,
            questionTarget,
            status: 'processing',
            jobId,
            requestedAt: new Date(),
        });
        await aiRequestModel.create({ user: req.userId, kind: 'reviewer' });
        startGeneration(reviewer._id, jobId);

        res.status(201).json({ success: true, reviewer: listItem(reviewer) });
    } catch (error) {
        console.error('Create reviewer error:', error);
        res.status(500).json({ success: false, message: error.message });
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

        res.json({
            success: true,
            dailyLimit: DAILY_GENERATION_LIMIT,
            usedToday: await requestsToday(req.userId),
            enabled: isGeminiConfigured(),
            reviewers: reviewers.map((r) => {
                const s = byReviewer.get(`${r._id}:${r.version}`);
                return { ...listItem(r), lastScore: s?.lastScore ?? null, lastStudiedAt: s?.lastAt ?? null, sessions: s?.sessions ?? 0 };
            }),
        });
    } catch (error) {
        console.error('Get reviewers error:', error);
        res.status(500).json({ success: false, message: error.message });
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
        console.error('Get reviewer error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getReviewerStatus = async (req, res) => {
    try {
        const reviewer = await findOwned(req, res);
        if (!reviewer) return;
        res.json({ success: true, status: reviewer.status, error: reviewer.error, version: reviewer.version });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
        }
        if (req.body.course !== undefined) reviewer.course = cleanLine(req.body.course, COURSE_MAX);
        await reviewer.save();
        res.json({ success: true, reviewer: listItem(reviewer) });
    } catch (error) {
        console.error('Update reviewer error:', error);
        res.status(500).json({ success: false, message: error.message });
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
        if (!reviewer.sourceText) {
            return res.status(409).json({ success: false, message: 'Upload the PDF again to make new questions.' });
        }
        const questionTarget = req.body.questionCount === undefined ? reviewer.questionTarget : parseQuestionCount(req.body.questionCount);
        if (!questionTarget) {
            return res.status(400).json({ success: false, message: `Pick ${QUESTION_COUNTS.join(', ')} questions.` });
        }
        if (await requestsToday(req.userId) >= DAILY_GENERATION_LIMIT) {
            return res.status(429).json({ success: false, message: limitMessage() });
        }

        const jobId = randomUUID();
        Object.assign(reviewer, { status: 'processing', error: '', jobId, requestedAt: new Date(), questionTarget });
        await reviewer.save();
        await aiRequestModel.create({ user: req.userId, kind: 'reviewer' });
        startGeneration(reviewer._id, jobId);

        res.json({ success: true, reviewer: listItem(reviewer) });
    } catch (error) {
        console.error('Regenerate reviewer error:', error);
        res.status(500).json({ success: false, message: error.message });
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
        console.error('Delete reviewer error:', error);
        res.status(500).json({ success: false, message: error.message });
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

        const mode = req.body.mode === 'weak' ? 'weak' : 'all';
        let pool = reviewer.questions;
        if (mode === 'weak') {
            const progress = computeProgress(reviewer, await finishedSessions(reviewer, req.userId));
            const weak = new Set(progress.weakTopics);
            pool = pool.filter((q) => weak.has(q.topic));
            if (!pool.length) {
                return res.status(400).json({ success: false, message: 'No weak topics right now. Finish a full session first.' });
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
        console.error('Start session error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSession = async (req, res) => {
    try {
        const { reviewer, attempt } = await loadSession(req, res);
        if (!attempt) return;
        res.json({ success: true, session: sessionPayload(attempt, reviewer) });
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const answerQuestion = async (req, res) => {
    try {
        const { reviewer, attempt } = await loadSession(req, res);
        if (!attempt) return;
        if (attempt.finishedAt) return res.status(409).json({ success: false, message: 'This session is already over.' });

        const { questionId, choice } = req.body;
        if (!isId(questionId) || !attempt.questions.some((id) => String(id) === String(questionId))) {
            return res.status(400).json({ success: false, message: "That question isn't part of this session." });
        }
        if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
            return res.status(400).json({ success: false, message: 'Pick one of the four answers.' });
        }
        const question = reviewer.questions.id(questionId);
        if (!question) return res.status(400).json({ success: false, message: "That question isn't part of this session." });

        // The first answer counts. A double click or a retry gets the same result back.
        const answer = { question: question._id, choice, correct: choice === question.correctIndex, answeredAt: new Date() };
        const updated = await reviewerAttemptModel.findOneAndUpdate(
            { _id: attempt._id, finishedAt: null, 'answers.question': { $ne: question._id } },
            { $push: { answers: answer } },
            { returnDocument: 'after' },
        );
        const current = updated || await reviewerAttemptModel.findById(attempt._id);
        const recorded = current.answers.find((a) => String(a.question) === String(question._id));
        if (!recorded) return res.status(409).json({ success: false, message: 'This session is already over.' });

        res.json({
            success: true,
            result: answerResult(question, recorded),
            answered: current.answers.length,
            total: current.questions.length,
        });
    } catch (error) {
        console.error('Answer question error:', error);
        res.status(500).json({ success: false, message: error.message });
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
                await attempt.deleteOne();
                return res.json({ success: true, session: null });
            }
            const correct = attempt.answers.filter((a) => a.correct).length;
            const answered = attempt.answers.length;
            finished = await reviewerAttemptModel.findOneAndUpdate(
                { _id: attempt._id, finishedAt: null },
                {
                    $set: {
                        finishedAt: new Date(),
                        correct,
                        answered,
                        total: attempt.questions.length,
                        score: scorePercent(correct, answered),
                        topicStats: topicStatsFor(reviewer.questions, attempt.answers),
                    },
                },
                { returnDocument: 'after' },
            ) || await reviewerAttemptModel.findById(attempt._id);
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
        console.error('Finish session error:', error);
        res.status(500).json({ success: false, message: error.message });
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
        console.error('Get progress error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
