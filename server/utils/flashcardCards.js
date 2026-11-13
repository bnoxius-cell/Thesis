import { FLASHCARD_LIMITS } from '../models/flashcardDeckModel.js';

// The text of a card as a student typed it. Strings only: anything else reads as empty, so an
// object or a number sent as a term is refused like a blank one.
// The term is one line. The answer keeps its line breaks, with no more than one blank line in a row.
const oneLine = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const withLineBreaks = (value) => (
    typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : ''
);

// Checks the front and back of one card (adding, editing, importing). Answers the cleaned
// `{ term, answer }`, or `{ error }` with a message that can be shown as it is.
export const readCardFields = ({ term, answer }) => {
    const front = oneLine(term);
    if (!front) return { error: 'Give the card a term.' };
    if (front.length > FLASHCARD_LIMITS.term) return { error: `The term can be up to ${FLASHCARD_LIMITS.term} characters.` };
    const back = withLineBreaks(answer);
    if (!back) return { error: 'Give the card an answer.' };
    if (back.length > FLASHCARD_LIMITS.answer) return { error: `The answer can be up to ${FLASHCARD_LIMITS.answer} characters.` };
    return { term: front, answer: back };
};
