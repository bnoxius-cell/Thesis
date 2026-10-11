import http from 'http';

// A stand-in for the Gemini REST API on localhost. Pointing GOOGLE_GEMINI_BASE_URL at it makes
// the real @google/genai SDK (and utils/gemini.js) talk to it over HTTP, so tests cover the
// actual request, the error statuses and the timeouts without a key or any quota.
//
//   const gemini = await startFakeGemini();
//   gemini.reply(() => ({ json: { ...reviewer } }));      // a good answer
//   gemini.reply(() => ({ status: 429 }));                 // busy
//   gemini.reply(() => ({ text: '{"cut off' }));           // not JSON
//   gemini.reply(() => ({ delayMs: 2000, json: {} }));     // slow
//   gemini.requests                                       // everything it was sent

// What Gemini sends back for a few real failures.
export const GEMINI_ERRORS = {
    badKey: { status: 400, error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } },
    leakedKey: { status: 403, error: { code: 403, message: 'Your API key was reported as leaked. Please use another API key.', status: 'PERMISSION_DENIED' } },
    noModel: { status: 404, error: { code: 404, message: 'models/gemini-nope is not found for API version v1beta.', status: 'NOT_FOUND' } },
    busy: { status: 429, error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED' } },
    overloaded: { status: 503, error: { code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE' } },
    tooBig: { status: 400, error: { code: 400, message: 'The input token count exceeds the maximum number of tokens allowed.', status: 'INVALID_ARGUMENT' } },
};

const candidate = (text, finishReason = 'STOP') => ({
    candidates: [{ index: 0, finishReason, content: { role: 'model', parts: text === undefined ? [] : [{ text }] } }],
    modelVersion: 'gemini-fake-001',
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
});

export const startFakeGemini = async () => {
    let handler = () => ({ json: {} });
    const requests = [];
    const sockets = new Set();

    const server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', async () => {
            let body = null;
            try { body = JSON.parse(raw); } catch { /* left null */ }
            const entry = {
                method: req.method,
                url: req.url,
                model: decodeURIComponent(req.url).match(/models\/([^:/?]+):generateContent/)?.[1],
                apiKey: req.headers['x-goog-api-key'],
                body,
                prompt: body?.contents?.[0]?.parts?.map((p) => p.text).join('') ?? '',
            };
            requests.push(entry);

            const plan = handler(entry, requests.length) || {};
            if (plan.delayMs) await new Promise((resolve) => { setTimeout(resolve, plan.delayMs); });
            if (res.destroyed) return;

            if (plan.error) {
                res.writeHead(plan.error.status, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: plan.error.error }));
                return;
            }
            if (plan.status) {
                res.writeHead(plan.status, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: { code: plan.status, message: plan.message || 'Error', status: 'ERROR' } }));
                return;
            }
            const text = 'json' in plan ? JSON.stringify(plan.json) : plan.text;
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify(candidate(text, plan.finishReason)));
        });
    });
    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });

    return {
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        reply(fn) { handler = fn; },
        reset() {
            requests.length = 0;
            handler = () => ({ json: {} });
        },
        close: () => new Promise((resolve) => {
            for (const socket of sockets) socket.destroy();
            server.close(resolve);
        }),
    };
};
