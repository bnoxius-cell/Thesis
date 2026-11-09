// Sharing a reviewer in a group chat: the snapshot posted with the message, and the copy a
// groupmate saves from it. Snapshots hold plain values, so the sender's later edits or deletion
// never change what was shared, and nothing carries the sender's ids, notes or file names.

const MAX_TOPIC_NAMES = 8;
const MAX_TOPIC_NAME = 80;
const MAX_SUMMARY = 280;

const clip = (text, max) => {
    const value = String(text ?? '');
    return value.length > max ? `${value.slice(0, max - 3).trimEnd()}...` : value;
};

// Why this reviewer can't be shared yet, or '' when it can.
export const shareBlocker = (reviewer) => {
    if (reviewer.status !== 'ready' || !reviewer.questions.length) return 'Wait until this reviewer is ready to share it.';
    if (reviewer.targeted?.status === 'processing') return 'Wait for the extra questions to finish first.';
    // An unnamed reviewer still carries the uploaded file's name, which isn't ours to hand out.
    if (reviewer.autoTitle) return 'Give this reviewer a name before you share it.';
    return '';
};

// `reviewer` is the card everyone sees; `reviewerContent` (answers included) is only read to save a copy.
export const reviewerSnapshot = (reviewer) => ({
    reviewer: {
        title: reviewer.title,
        course: reviewer.course,
        questionCount: reviewer.questions.length,
        topicNames: reviewer.topics.slice(0, MAX_TOPIC_NAMES).map((t) => clip(t.name, MAX_TOPIC_NAME)),
        summary: clip(reviewer.summary, MAX_SUMMARY),
    },
    reviewerContent: {
        source: {
            type: reviewer.source.type,
            count: reviewer.source.count,
            pages: reviewer.source.pages,
            slides: reviewer.source.slides,
            chars: reviewer.source.chars,
            truncated: reviewer.source.truncated,
        },
        summary: reviewer.summary,
        keyPoints: [...reviewer.keyPoints],
        keyTerms: reviewer.keyTerms.map(({ term, definition }) => ({ term, definition })),
        topics: reviewer.topics.map(({ name, summary }) => ({ name, summary })),
        questions: reviewer.questions.map((q) => ({
            topic: q.topic,
            prompt: q.prompt,
            options: [...q.options],
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            difficulty: q.difficulty,
        })),
    },
});

// Every piece of text a shared reviewer puts in front of the group, for the family-friendly filter.
export const reviewerTexts = ({ reviewer, reviewerContent: content }) => [
    reviewer.title,
    reviewer.course,
    reviewer.summary,
    ...reviewer.topicNames,
    content.summary,
    ...content.keyPoints,
    ...content.keyTerms.flatMap((t) => [t.term, t.definition]),
    ...content.topics.flatMap((t) => [t.name, t.summary]),
    ...content.questions.flatMap((q) => [q.topic, q.prompt, ...q.options, q.explanation]),
];

// The fields of a groupmate's own, ready copy. With no sourceText it can be studied but not
// regenerated or extended, which the reviewer routes already answer with a 409.
export const reviewerCopyFields = ({ message, owner, course, subject }) => {
    const content = message.reviewerContent;
    const now = new Date();
    return {
        owner,
        title: message.reviewer.title,
        autoTitle: false,
        course,
        subject,
        source: { ...content.source, fileName: '' },
        sources: [],
        sourceText: '',
        questionTarget: content.questions.length,
        status: 'ready',
        requestedAt: now,
        generatedAt: now,
        version: 1,
        summary: content.summary,
        keyPoints: content.keyPoints,
        keyTerms: content.keyTerms,
        topics: content.topics,
        questions: content.questions.map((q) => ({ ...q, batch: '' })),
        copiedFrom: `message:${message._id}`,
    };
};
