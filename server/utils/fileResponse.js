// How file routes answer (plan 18, 3.7 and 3.8): limit errors as plain JSON the client can branch
// on, and short-lived read links. A link is a bearer secret, so nothing here logs, stores or
// puts one in a URL.
import { FileLimitError, fileError } from './fileBudget.js';
import { canRead } from './fileAccess.js';
import { getFileLimits } from './fileLimits.js';
import { issueFileLinks } from './storedFiles.js';
import { serverError } from './httpErrors.js';
import { hit } from './rateLimit.js';

// A FileLimitError goes out as its row in 3.7. Anything else is a real fault: logged under `label`
// (which must never include a URL) and answered with the plain server message.
export const sendFileError = (res, error, label) => {
    if (!(error instanceof FileLimitError)) return serverError(res, label, error);
    const body = { success: false, code: error.code, message: error.message };
    if (error.resumesAt) body.resumesAt = error.resumesAt;
    return res.status(error.status).json(body);
};

// Counts one hit for `key`. When the student is over the limit the 429 `slow_down` answer is
// already sent and this returns false.
export const allowBurst = (res, key, rule) => {
    const { ok, retryAfterMs } = hit(key, rule);
    if (!ok) {
        res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
        sendFileError(res, fileError('slow_down'));
    }
    return ok;
};

// Answers a link route: `rows` are the file rows the route loaded from its parent (group or
// subject) by both ids. Every row is checked with canRead here, so no route can hand out a link
// it forgot to check; one row without access makes the whole request a 404 and spends nothing.
export const sendFileLinks = async (req, res, rows, { variant }) => {
    res.set('Cache-Control', 'no-store');
    try {
        if (!allowBurst(res, `links:${req.userId}`, getFileLimits().linkBurst)) return;
        const allowed = await Promise.all(rows.map((row) => canRead(req.userId, row)));
        if (!allowed.every(Boolean)) throw fileError('not_found');
        const links = await issueFileLinks(rows, { variant, userId: req.userId });
        res.json({ success: true, links });
    } catch (error) {
        sendFileError(res, error, 'Handing out file links failed');
    }
};
