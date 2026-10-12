// The server works out check-in scores itself from the answers, so a score sent by the
// browser is never trusted. Same maths as the two modals in the client.

// PSS-10: ten answers, 0 to 4 each. Items 4, 5, 7 and 8 are positively worded and reversed.
const PSS_REVERSED = [3, 4, 6, 7];

// WHO-5: five answers, 0 to 5 each. The raw total (0 to 25) times 4 gives a percentage.

const validAnswers = (responses, length, max) => (
    Array.isArray(responses)
    && responses.length === length
    && responses.every((value) => Number.isInteger(value) && value >= 0 && value <= max)
);

// Both return the score, or null when the answers are missing or out of range.
export const scorePSS = (responses) => {
    if (!validAnswers(responses, 10, 4)) return null;
    return responses.reduce((total, value, index) => total + (PSS_REVERSED.includes(index) ? 4 - value : value), 0);
};

export const scoreWHO = (responses) => {
    if (!validAnswers(responses, 5, 5)) return null;
    return responses.reduce((total, value) => total + value, 0) * 4;
};
