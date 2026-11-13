// Grading for answers the student types, done on the server and never by AI (plan 33, 2.5).
// Pure functions, so tests can import this without a database.

const LEADING_ARTICLE = /^(the|a|an|ang) /;

// The form two answers are compared in: no case, accents, punctuation or leading article.
export const normalizeTyped = (text) => String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '');

// Edit distance, giving up early once it is certain to be above `max`.
const withinDistance = (a, b, max) => {
    if (Math.abs(a.length - b.length) > max) return false;
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
        const row = [i];
        for (let j = 1; j <= b.length; j += 1) {
            row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        if (Math.min(...row) > max) return false;
        previous = row;
    }
    return previous[b.length] <= max;
};

// How many typing slips are forgiven in an answer of this length (spaces not counted).
const typosAllowed = (length) => (length >= 10 ? 2 : length >= 5 ? 1 : 0);

const matchesForm = (typed, form) => {
    if (typed === form) return true;
    const tight = typed.replace(/ /g, '');
    const formTight = form.replace(/ /g, '');
    if (tight === formTight) return true;
    // Numbers must be exact: 1024 and 1023 are different answers.
    if (/\d/.test(form)) return false;
    return withinDistance(tight, formTight, typosAllowed(formTight.length));
};

export const gradeTyped = (text, { answer, accepted = [] }) => {
    const typed = normalizeTyped(text);
    if (!typed) return false;
    return [answer, ...accepted].map(normalizeTyped).filter(Boolean).some((form) => matchesForm(typed, form));
};

// Order never matters. Each entry claims the first item it matches that no earlier entry took;
// empty entries and repeats claim nothing. `matched[i]` is the item entry `i` matched, or -1.
export const gradeList = (entries, items) => {
    const claimed = new Set();
    const seen = new Set();
    const matched = entries.map((entry) => {
        const key = normalizeTyped(typeof entry === 'string' ? entry : '');
        if (!key || seen.has(key)) return -1;
        seen.add(key);
        const index = items.findIndex((item, i) => !claimed.has(i) && gradeTyped(entry, item));
        if (index >= 0) claimed.add(index);
        return index;
    });
    return { got: claimed.size, of: items.length, matched };
};

// An essay is right when its answer covers two thirds of the key points, rounded up.
export const essayPassed = (got, of) => got >= Math.ceil((of * 2) / 3);
