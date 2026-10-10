// How a student is doing on a reviewer, per topic. Pure, so the thresholds are easy to test and
// to cite. Only finished sessions on the reviewer's current question set count, and only the
// most recent few, so improving on a topic shows up quickly.

export const RECENT_SESSIONS = 5;
export const WEAK_BELOW = 0.6;
export const STRONG_FROM = 0.8;
export const MIN_ANSWERS_FOR_LEVEL = 2;

const idOf = (value) => String(value?._id ?? value);

export const topicLevel = (correct, answered) => {
    if (answered < MIN_ANSWERS_FOR_LEVEL) return 'new';
    const accuracy = correct / answered;
    if (accuracy < WEAK_BELOW) return 'weak';
    if (accuracy >= STRONG_FROM) return 'strong';
    return 'fair';
};

export const scorePercent = (correct, answered) => (answered > 0 ? Math.round((correct / answered) * 100) : null);

// Correct/answered per topic for one session's answers.
export const topicStatsFor = (questions, answers) => {
    const topicOf = new Map(questions.map((q) => [idOf(q), q.topic]));
    const stats = new Map();
    for (const answer of answers) {
        const topic = topicOf.get(idOf(answer.question));
        if (!topic) continue;
        const row = stats.get(topic) || { topic, correct: 0, total: 0 };
        row.total += 1;
        if (answer.correct) row.correct += 1;
        stats.set(topic, row);
    }
    return [...stats.values()];
};

export const summarizeAttempt = (attempt) => ({
    _id: attempt._id,
    mode: attempt.mode,
    version: attempt.version,
    correct: attempt.correct ?? 0,
    answered: attempt.answered ?? 0,
    total: attempt.total ?? 0,
    score: attempt.score ?? null,
    startedAt: attempt.createdAt,
    finishedAt: attempt.finishedAt,
});

const finishedTime = (attempt) => new Date(attempt.finishedAt).getTime();

export const computeProgress = (reviewer, attempts) => {
    const current = attempts
        .filter((a) => a.finishedAt && a.version === reviewer.version)
        .sort((a, b) => finishedTime(b) - finishedTime(a));
    const recent = current.slice(0, RECENT_SESSIONS);

    const totals = new Map();
    for (const attempt of recent) {
        for (const row of attempt.topicStats || []) {
            const t = totals.get(row.topic) || { correct: 0, answered: 0 };
            t.correct += row.correct;
            t.answered += row.total;
            totals.set(row.topic, t);
        }
    }

    const questionCount = new Map();
    for (const q of reviewer.questions || []) questionCount.set(q.topic, (questionCount.get(q.topic) || 0) + 1);

    const topics = (reviewer.topics || [])
        .filter((t) => questionCount.get(t.name))
        .map((t) => {
            const { correct, answered } = totals.get(t.name) || { correct: 0, answered: 0 };
            return {
                name: t.name,
                questionCount: questionCount.get(t.name),
                correct,
                answered,
                accuracy: answered ? correct / answered : null,
                level: topicLevel(correct, answered),
            };
        });

    const weakTopics = topics
        .filter((t) => t.level === 'weak')
        .sort((a, b) => a.accuracy - b.accuracy)
        .map((t) => t.name);

    const scores = current.map((a) => a.score).filter((s) => s !== null && s !== undefined);
    return {
        topics,
        weakTopics,
        sessions: current.length,
        lastScore: scores.length ? scores[0] : null,
        bestScore: scores.length ? Math.max(...scores) : null,
    };
};
