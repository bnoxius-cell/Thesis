// Checks the real Gemini setup end to end without the app: reads a PDF, asks Gemini for a
// reviewer exactly like the server does (split into parts if it's long), then asks for a few
// targeted questions on its first topic, and prints what came back. Uses GEMINI_API_KEY (and
// GEMINI_MODEL if set) from server/.env. Nothing is saved. Makes 2 to 4 requests.
//
//   npm run smoke:gemini -- path/to/notes.pdf [questionCount]
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { extractPdfText, splitIntoParts, MIN_SOURCE_CHARS, PART_CHARS } from '../utils/pdfText.js';
import { generateJson, isGeminiConfigured, geminiModel } from '../utils/gemini.js';
import {
    REVIEWER_SCHEMA, REVIEWER_SYSTEM, TARGETED_SCHEMA, buildReviewerPrompt, buildTargetedPrompt, planParts,
    normalizeReviewer, normalizeTargeted, textForTopics,
} from '../utils/reviewerContent.js';

const [file, countArg] = process.argv.slice(2);
if (!file) {
    console.error('Usage: npm run smoke:gemini -- path/to/notes.pdf [questionCount]');
    process.exit(1);
}
if (!isGeminiConfigured()) {
    console.error('GEMINI_API_KEY is not set in server/.env.');
    process.exit(1);
}

// Like the server: a busy service (429, 5xx) is asked again after a short wait.
const RETRY_DELAYS_MS = [5000, 15000, 30000];
const ask = async (request) => {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await generateJson(request);
        } catch (error) {
            const busy = error.status === 429 || error.status >= 500;
            if (!busy || attempt >= RETRY_DELAYS_MS.length) throw error;
            console.log(`  HTTP ${error.status}, trying again in ${RETRY_DELAYS_MS[attempt] / 1000}s...`);
            await new Promise((resolve) => { setTimeout(resolve, RETRY_DELAYS_MS[attempt]); });
        }
    }
};

const seconds = (since) => `${((Date.now() - since) / 1000).toFixed(1)}s`;
const printQuestion = (q) => {
    console.log(`  [${q.topic}, ${q.difficulty}] ${q.prompt}`);
    q.options.forEach((o, i) => console.log(`    ${'ABCD'[i]}. ${o}${i === q.correctIndex ? '  <- answer' : ''}`));
    console.log(`    Why: ${q.explanation}`);
};

const questionCount = Number(countArg) || 10;
const extracted = await extractPdfText(await readFile(file));
console.log(`PDF: ${extracted.pages} pages, ${extracted.chars} characters${extracted.truncated ? ' (cut to the limit)' : ''}`);
if (extracted.text.length < MIN_SOURCE_CHARS) {
    console.error('Not enough text in this PDF (scanned pages have none).');
    process.exit(1);
}

const parts = splitIntoParts(extracted.text);
const plan = planParts(parts.map((p) => p.length), questionCount);
console.log(`Asking ${geminiModel()} for ${questionCount} questions in ${parts.length} ${parts.length === 1 ? 'request' : 'requests at once'}...`);

try {
    let started = Date.now();
    const answers = await Promise.all(parts.map((text, i) => ask({
        system: REVIEWER_SYSTEM,
        prompt: buildReviewerPrompt({ title: file, course: '', text, part: plan[i] }),
        schema: REVIEWER_SCHEMA,
    })));
    const reviewer = normalizeReviewer(answers.map((a) => a.data), { questionCount, shares: plan.map((p) => p.questions) });
    const written = answers.reduce((sum, a) => sum + (a.data.questions?.length ?? 0), 0);
    console.log(`Answered by ${answers[0].model} in ${seconds(started)}`);
    console.log(`Title: ${reviewer.title}`);
    console.log(`Topics: ${reviewer.topics.map((t) => t.name).join(', ')}`);
    console.log(`Key points: ${reviewer.keyPoints.length}, key terms: ${reviewer.keyTerms.length}, questions kept: ${reviewer.questions.length} of ${written}`);
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
    console.error(`Failed${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message}`);
    // exitCode, not exit(): exiting while the SDK still has sockets open crashes Node on Windows.
    process.exitCode = 1;
}
