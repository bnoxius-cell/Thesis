// The review schedule: five boxes, each with a longer wait before a card comes back. Pure, so it
// is tested without a database. Days are Philippine days (UTC+8, no daylight saving), because
// that is where the students are: a card is due for the whole day, never "at 3:47 pm".
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PH_OFFSET_MS = 8 * HOUR_MS;

export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const MASTERED_BOX = 4;
const TOP_BOX = INTERVAL_DAYS.length - 1;

export const phDayStart = (now) => new Date(Math.floor((now.getTime() + PH_OFFSET_MS) / DAY_MS) * DAY_MS - PH_OFFSET_MS);

export const tomorrowStart = (now) => new Date(phDayStart(now).getTime() + DAY_MS);

export const isDue = (dueAt, now) => dueAt < tomorrowStart(now);

// Whole Philippine days from today to the day a card comes back (0 is today).
export const nextDueDays = (dueAt, now) => Math.round((phDayStart(dueAt) - phDayStart(now)) / DAY_MS);

// What a rating does to a card, as the fields to write:
//  - 'got' moves a due card up one box and out by that box's wait. A card that isn't due (a double
//    click, a retry, a practice run) is left alone, so it can't be pushed further out.
//  - 'learning' always counts: back to box 0 and due again today. It only adds a lapse when the
//    card had climbed to box 2 or higher, so repeating it changes nothing else.
// Answers { counted, fields }, or null when the rating is neither.
export const applyRating = (card, rating, now) => {
    if (rating === 'got') {
        if (!isDue(card.dueAt, now)) return { counted: false };
        const box = Math.min(card.box + 1, TOP_BOX);
        return {
            counted: true,
            fields: {
                box,
                dueAt: new Date(phDayStart(now).getTime() + INTERVAL_DAYS[box] * DAY_MS),
                reviews: card.reviews + 1,
                reviewedAt: now,
            },
        };
    }
    if (rating === 'learning') {
        return {
            counted: true,
            fields: {
                box: 0,
                dueAt: now,
                lapses: card.lapses + (card.box >= 2 ? 1 : 0),
                reviews: card.reviews + 1,
                reviewedAt: now,
            },
        };
    }
    return null;
};

// `cards` in the deck, how many were `reviewed` at least once and how many sit in a mastered box.
export const deckStatus = ({ cards, reviewed, mastered }) => {
    if (cards === 0 || reviewed === 0) return 'new';
    return mastered === cards ? 'mastered' : 'learning';
};
