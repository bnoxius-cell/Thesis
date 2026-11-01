// RGI_Emoji needs the `v` flag (Node 20+). If the runtime can't compile this, the module fails to load.
const SINGLE_EMOJI = /^\p{RGI_Emoji}$/v;
const MAX_EMOJI_LENGTH = 32; // UTF-16 units; the longest ZWJ family sequences fit well under this

// True for exactly one emoji (skin tones and ZWJ sequences included), nothing else.
export const isSingleEmoji = (value) => typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_EMOJI_LENGTH
    && SINGLE_EMOJI.test(value);
