// Word filter for groups set to "family-friendly". It is a plain block list on whole words,
// so innocent words that merely contain a bad one ("class", "assess") are never caught.
// It won't catch everything, and that's fine: it's there to keep a chat tidy, not to police it.

const WORDS = [
    // English
    'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bastard',
    'asshole', 'dick', 'dickhead', 'cock', 'pussy', 'cunt', 'slut', 'whore', 'piss', 'prick',
    'wtf', 'stfu', 'damn', 'crap', 'porn', 'nude', 'nudes', 'nigga', 'nigger', 'faggot', 'retard',
    'ass', 'arse', 'jerkoff', 'wanker', 'twat', 'boobs', 'horny',
    // Filipino
    'putangina', 'tangina', 'tanginamo', 'puta', 'putang', 'gago', 'tarantado', 'ulol',
    'bobo', 'tanga', 'pakyu', 'pucha', 'lintik', 'kantot', 'jakol', 'puke', 'pekpek',
    'tite', 'burat', 'bwisit', 'siraulo', 'punyeta', 'pokpok', 'hinayupak',
];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

const SUFFIXES = '(?:s|es|ed|er|ers|ing|in|y|ie)?';
const pattern = new RegExp(`(?:^|[^a-z])(?:${WORDS.join('|')})${SUFFIXES}(?![a-z])`, 'i');

// "f.u.c.k", "sh1t", "fuuuck" and "f u c k" all read the same to a person, so they
// should to the filter too.
const normalize = (text) => {
    // Only words that already contain a letter get the number/symbol swap, so "Room 455"
    // never turns into "room ass".
    const lowered = String(text).toLowerCase().replace(/\S+/g, (token) => (
        /[a-z]/.test(token) ? token.replace(/[0-9@$!]/g, (c) => LEET[c] || c) : token
    ));
    const collapsed = lowered
        .replace(/(?<=\b[a-z])[\s.\-_*]+(?=[a-z]\b)/g, '') // single letters spread out: "f u c k"
        .replace(/(?<=[a-z])[.\-_*]+(?=[a-z])/g, '') // punctuation inside a word: "f.u.c.k"
        .replace(/([a-z])\1{2,}/g, '$1$1'); // stretched letters: "fuuuuck"
    // A doubled letter might be real ("ass", "shit" has none), so also try it squeezed to one.
    return [collapsed, collapsed.replace(/([a-z])\1+/g, '$1')];
};

export const containsProfanity = (text) => {
    if (!text || typeof text !== 'string') return false;
    return normalize(text).some((variant) => pattern.test(variant));
};
