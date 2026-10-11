// What to do when a Gemini request fails: ask again, or give up with a message a student can
// act on. Shared by the reviewer controller and the smoke script, so both behave the same.

const messageOf = (error) => String(error?.message || '');

// No answer in time: the SDK aborts the request, or Gemini answers 504 itself.
export const isTimeout = (error) =>
    error?.status === 504 || error?.name === 'AbortError' || /timed? ?out|aborted/i.test(messageOf(error));

// A wrong, expired or blocked key, or a model name that doesn't exist. Nothing a student can
// fix, and asking again won't help, so the server log says what to check.
export const isSetupProblem = (error) =>
    [401, 403, 404].includes(error?.status) || (error?.status === 400 && /api[ _]?key/i.test(messageOf(error)));

// Busy (429), a server-side problem (5xx), a timeout, or output we couldn't use: worth another try.
export const isRetryable = (error) => !isSetupProblem(error) && (
    error?.code === 'invalid_output' || error?.status === 429 || (error?.status >= 500 && error?.status < 600) || isTimeout(error)
);

export const friendlyError = (error, { targeted = false } = {}) => {
    if (error?.code === 'invalid_output') {
        return targeted
            ? "We couldn't get good questions on those topics. Try again, or pick other topics."
            : "We couldn't get good questions out of this PDF. Try again, or try a PDF with more text.";
    }
    if (isSetupProblem(error)) return "Reviewers aren't working on our side right now. Try again later.";
    if (error?.status === 429) return 'The AI service is busy right now. Try again in a few minutes.';
    if (isTimeout(error)) return 'The AI took too long to answer. Try again, or try a shorter PDF.';
    if (error?.status >= 500) return 'The AI service had a problem. Try again in a bit.';
    if (error?.status === 400) return "The AI service couldn't work with this material. Try a different PDF.";
    return "We couldn't make this reviewer. Try again.";
};

// One line for the server log. The SDK puts Gemini's whole error body in the message.
export const describeError = (error) => {
    const hint = isSetupProblem(error) ? ' (check GEMINI_API_KEY and GEMINI_MODEL)' : '';
    return `${error?.status || error?.code || error?.name || 'error'}${hint}: ${messageOf(error).slice(0, 300)}`;
};

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Calls `request`, and calls it again after each wait in `delaysMs` while the failure is one
// worth retrying. `onRetry` is told before each wait.
export const withRetries = async (request, delaysMs, onRetry) => {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await request();
        } catch (error) {
            if (!isRetryable(error) || attempt >= delaysMs.length) throw error;
            onRetry?.(error, delaysMs[attempt]);
            await sleep(delaysMs[attempt]);
        }
    }
};
