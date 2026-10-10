// Checks the real Gemini setup end to end without the app: reads a PDF, asks Gemini for a
// reviewer exactly like the server does, and prints what came back. Uses GEMINI_API_KEY (and
// GEMINI_MODEL if set) from server/.env. Nothing is saved.
//
//   npm run smoke:gemini -- path/to/notes.pdf [questionCount]
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { extractPdfText, MIN_SOURCE_CHARS } from '../utils/pdfText.js';
import { generateJson, isGeminiConfigured, geminiModel } from '../utils/gemini.js';
import { REVIEWER_SCHEMA, REVIEWER_SYSTEM, buildReviewerPrompt, normalizeReviewer } from '../utils/reviewerContent.js';

const [file, countArg] = process.argv.slice(2);
if (!file) {
    console.error('Usage: npm run smoke:gemini -- path/to/notes.pdf [questionCount]');
    process.exit(1);
}
if (!isGeminiConfigured()) {
    console.error('GEMINI_API_KEY is not set in server/.env.');
    process.exit(1);
}

const questionCount = Number(countArg) || 10;
const extracted = await extractPdfText(await readFile(file));
console.log(`PDF: ${extracted.pages} pages, ${extracted.chars} characters${extracted.truncated ? ' (cut to the limit)' : ''}`);
if (extracted.text.length < MIN_SOURCE_CHARS) {
    console.error('Not enough text in this PDF (scanned pages have none).');
    process.exit(1);
}

console.log(`Asking ${geminiModel()} for ${questionCount} questions...`);
const started = Date.now();
try {
    const { data, model } = await generateJson({
        system: REVIEWER_SYSTEM,
        prompt: buildReviewerPrompt({ title: file, course: '', text: extracted.text, questionCount }),
        schema: REVIEWER_SCHEMA,
    });
    const reviewer = normalizeReviewer(data, { questionCount });
    console.log(`Answered by ${model} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log(`Topics: ${reviewer.topics.map((t) => t.name).join(', ')}`);
    console.log(`Key points: ${reviewer.keyPoints.length}, key terms: ${reviewer.keyTerms.length}, questions kept: ${reviewer.questions.length} of ${data.questions?.length ?? 0}`);
    const q = reviewer.questions[0];
    console.log(`\nSample: ${q.prompt}`);
    q.options.forEach((o, i) => console.log(`  ${'ABCD'[i]}. ${o}${i === q.correctIndex ? '  <- answer' : ''}`));
    console.log(`  Why: ${q.explanation}`);
} catch (error) {
    console.error(`Failed${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message}`);
    process.exit(1);
}
