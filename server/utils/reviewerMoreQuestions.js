// Questions past the first round (plan 21, 3.10): a reviewer of 50 or 100 questions gets 30 with its
// content, and the rest come from here in waves of up to two calls at a time. Every call is shown
// the questions written so far and one part of the material. A wave that adds little means the
// material has run out; a failed call, or too much time spent, ends it too. The questions already
// made are always kept.
import { generateJson } from './gemini.js';
import { describeError } from './aiErrors.js';
import {
    MORE_PER_CALL, REVIEWER_SYSTEM, TARGETED_SCHEMA, buildMorePrompt, normalizeTargeted, shareOut, withoutRepeats,
} from './reviewerContent.js';

const CALLS_PER_WAVE = 2;
// No new wave starts after a job has run this long. A call already under way is never cut off.
export const WAVES_STOP_AFTER_MS = 40 * 60 * 1000;

// How many questions each call of the next wave asks for, sharing `left` evenly.
const waveSizes = (left) => {
    const calls = Math.min(CALLS_PER_WAVE, Math.ceil(left / MORE_PER_CALL));
    return shareOut(Math.min(left, calls * MORE_PER_CALL), Array(calls).fill(1));
};

// A thin answer is not worth asking again (the material may simply be short), so it is kept
// as it is; only an answer that isn't usable at all is retried.
const askForMore = ({ retry, ...request }) => retry(async () => {
    const { data } = await generateJson({
        system: REVIEWER_SYSTEM, prompt: buildMorePrompt(request), schema: TARGETED_SCHEMA,
    });
    return normalizeTargeted(data, {
        topics: request.topics, existing: request.existing, questionCount: request.questionCount, minQuestions: 0,
    });
});

// The questions to add to `questions` (the ones made so far, as stored) to reach `target`.
// `parts` is the text of the material; calls take them in turn, longest first. `retry` wraps one
// request in the job's retries, `deadline` is a timestamp, and `onProgress(done, total)` is told
// after each wave.
export const writeMoreQuestions = async ({ title, course, parts, topics, questions, target, retry, deadline, onProgress }) => {
    const turns = [...parts].sort((a, b) => b.length - a.length);
    const made = [...questions];
    let turn = 0;

    while (made.length < target && Date.now() < deadline) {
        const sizes = waveSizes(target - made.length);
        const existing = made.map((q) => q.prompt);
        const settled = await Promise.allSettled(sizes.map((questionCount) => askForMore({
            retry, title, course, topics, existing, questionCount, text: turns[turn++ % turns.length],
        })));

        const answers = settled.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
        const added = withoutRepeats(answers, existing).slice(0, target - made.length);
        made.push(...added);
        await onProgress(made.length, target);

        const failed = settled.find((r) => r.status === 'rejected');
        if (failed) console.error('More questions failed:', describeError(failed.reason));
        if (failed || added.length * 2 < sizes.reduce((a, b) => a + b, 0)) break;
    }
    return made.slice(questions.length);
};
