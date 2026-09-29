// Small pictures (profile photos, group icons) are shrunk in the browser and stored as data
// URLs. The browser is not trusted, so the server checks the shape and size again.

export const MAX_AVATAR_CHARS = 24 * 1024;

const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

// '' means "no picture". Anything else has to be a small image data URL.
export const isValidPicture = (value, maxChars = MAX_AVATAR_CHARS) =>
    value === '' || (typeof value === 'string' && value.length <= maxChars && DATA_URL.test(value));
