// Checks the real Gemini setup end to end without the app: reads one or more files (PDF, Word,
// PowerPoint, PNG, JPEG or WebP) exactly like the server does (photos and scanned PDFs are
// transcribed by Gemini first), asks Gemini for a reviewer (split into parts if it's long), then
// asks for a few targeted questions on its first topic, and prints what came back. Uses
// GEMINI_API_KEY (and GEMINI_MODEL if set) from server/.env. Nothing is saved. Makes 2 or more
// requests: one per photo or scanned PDF, then 2 to 4 (a few more for 50 or 100 questions).
//
//   npm run smoke:gemini -- [--count 100] path/to/notes.pdf [more files...]
//
// --count is the number of questions: 10, 15, 20, 30, 50 or 100 (default 10).
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { splitIntoParts, MIN_SOURCE_CHARS, PART_CHARS } from '../utils/pdfText.js';
import { generateJson, isGeminiConfigured, geminiModel } from '../utils/gemini.js';
import { withRetries, friendlyError, describeError } from '../utils/aiErrors.js';
import { combineSources, readSources, sourceTypeOf } from '../utils/reviewerSource.js';
import { transcribeSources, unreadableError } from '../utils/reviewerPictures.js';
import {
    FIRST_ROUND_MAX, QUESTION_COUNTS, REVIEWER_SCHEMA, REVIEWER_SYSTEM, TARGETED_SCHEMA, buildReviewerPrompt, buildTargetedPrompt,
    planParts, normalizeReviewer, normalizeTargeted, textForTopics,
} from '../utils/reviewerContent.js';
import { WAVES_STOP_AFTER_MS, writeMoreQuestions } from '../utils/reviewerMoreQuestions.js';

const args = process.argv.slice(2);
const countAt = args.indexOf('--count');
const countArg = countAt === -1 ? '' : args.splice(countAt, 2)[1];
const paths = args;
if (!paths.length || (countArg && !QUESTION_COUNTS.includes(Number(countArg)))) {
    console.error(`Usage: npm run smoke:gemini -- [--count ${QUESTION_COUNTS.join('|')}] path/to/notes.pdf [more files...]`);
    process.exit(1);
}
if (!isGeminiConfigured()) {
    console.error('GEMINI_API_KEY is not set in server/.env.');
    process.exit(1);
}

// Same retry rules as the server (utils/aiErrors.js).
const RETRY_DELAYS_MS = [4000, 12000, 30000];
const retry = (request) => withRetries(request, RETRY_DELAYS_MS, (error, wait) => {
    console.log(`  ${describeError(error).slice(0, 120)}. Trying again in ${wait / 1000}s...`);
});
const ask = (request) => retry(() => generateJson(request));

const seconds = (since) => `${((Date.now() - since) / 1000).toFixed(1)}s`;
const printQuestion = (q) => {
    console.log(`  [${q.topic}, ${q.difficulty}] ${q.prompt}`);
    q.options.forEach((o, i) => console.log(`    ${'ABCD'[i]}. ${o}${i === q.correctIndex ? '  <- answer' : ''}`));
    console.log(`    Why: ${q.explanation}`);
};

const questionCount = Number(countArg) || 10;
const firstRound = Math.min(questionCount, FIRST_ROUND_MAX);
const file = paths.map((path) => basename(path)).join(', ');
const items = [];
for (const path of paths) {
    const buffer = await readFile(path);
    const name = basename(path);
    items.push({ buffer, name, bytes: buffer.length, file: null, ...sourceTypeOf(buffer, name) });
}
let started = Date.now();
const sources = await readSources(items);
console.log(`Text read in ${seconds(started)}; ${sources.filter((source) => source.picture).length} picture(s) for Gemini to read.`);

started = Date.now();
const transcribed = await transcribeSources(sources, {
    retry,
    onProgress: (done, total) => console.log(`  picture ${done} of ${total} read (${seconds(started)})`),
});
for (const source of transcribed) {
    console.log(`  ${source.fileName}: ${source.chars} characters${source.skipped ? ' (left out, too little text)' : ''}`);
}
const combined = combineSources(transcribed, 'smoke');
console.log(`Text length: ${combined.text.length} characters${combined.summary.truncated ? ' (cut to the limit)' : ''}`);
if (combined.bodyChars < MIN_SOURCE_CHARS) {
    console.error(`Not enough text. A student would see: ${unreadableError(transcribed).message}`);
    process.exit(1);
}
const parts = splitIntoParts(combined.text);
const plan = planParts(parts.map((p) => p.length), firstRound);
console.log(`Asking ${geminiModel()} for ${questionCount} questions in ${parts.length} ${parts.length === 1 ? 'request' : 'requests at once'}...`);

try {
    started = Date.now();
    const answers = await Promise.all(parts.map((text, i) => ask({
        system: REVIEWER_SYSTEM,
        prompt: buildReviewerPrompt({ title: file, course: '', text, part: plan[i] }),
        schema: REVIEWER_SCHEMA,
    })));
    const reviewer = normalizeReviewer(answers.map((a) => a.data), { questionCount: firstRound, shares: plan.map((p) => p.questions) });
    const written = answers.reduce((sum, a) => sum + (a.data.questions?.length ?? 0), 0);
    console.log(`Answered by ${answers[0].model} in ${seconds(started)}`);
    if (questionCount > firstRound) {
        console.log(`\nWriting ${questionCount - reviewer.questions.length} more questions in waves...`);
        started = Date.now();
        reviewer.questions.push(...await writeMoreQuestions({
            title: file,
            course: '',
            parts,
            topics: reviewer.topics.map((t) => t.name),
            questions: reviewer.questions,
            target: questionCount,
            retry,
            deadline: Date.now() + WAVES_STOP_AFTER_MS,
            onProgress: (done, total) => console.log(`  ${done} of ${total} questions (${seconds(started)})`),
        }));
        console.log(`Kept ${reviewer.questions.length} of ${questionCount} questions in ${seconds(started)}`);
    }
    console.log(`Title: ${reviewer.title}`);
    console.log(`Topics: ${reviewer.topics.map((t) => t.name).join(', ')}`);
    console.log(`Key points: ${reviewer.keyPoints.length}, key terms: ${reviewer.keyTerms.length}, questions kept: ${reviewer.questions.length}${questionCount > firstRound ? '' : ` of ${written}`}`);
    console.log(`Difficulty: ${['easy', 'medium', 'hard'].map((d) => `${reviewer.questions.filter((q) => q.difficulty === d).length} ${d}`).join(', ')}`);
    console.log('\nSample:');
    printQuestion(reviewer.questions[0]);

    const topics = [reviewer.topics[0].name];
    const existing = reviewer.questions.filter((q) => topics.includes(q.topic)).map((q) => q.prompt);
    console.log(`\nTargeted review: asking for 5 more questions on "${topics[0]}"...`);
    started = Date.now();
    const { data } = await ask({
        system: REVIEWER_SYSTEM,
        prompt: buildTargetedPrompt({
            title: reviewer.title,
            course: '',
            text: textForTopics(parts, reviewer.topics, topics, PART_CHARS),
            topics,
            questionCount: 5,
            existing,
        }),
        schema: TARGETED_SCHEMA,
    });
    const extra = normalizeTargeted(data, { topics, existing, questionCount: 5 });
    console.log(`Answered in ${seconds(started)}. Kept ${extra.length} of ${data.questions?.length ?? 0}.`);
    printQuestion(extra[0]);
} catch (error) {
    console.error(`Failed: ${describeError(error)}`);
    console.error(`A student would see: ${friendlyError(error)}`);
    // exitCode, not exit(): exiting while the SDK still has sockets open crashes Node on Windows.
    process.exitCode = 1;
}
