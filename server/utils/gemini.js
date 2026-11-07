import { GoogleGenAI } from '@google/genai';

// The only file that talks to the Gemini API. The key stays on the server (GEMINI_API_KEY) and
// never reaches the browser. Tests mock this module instead of the SDK.

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
// How long one request may take. A full 120k-character part took 70 to 100 seconds on
// 2026-10-11, so this leaves room. Tests shorten it.
export const geminiSettings = { timeoutMs: 150000 };

let client = null;
let clientKey = '';

const getClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
    if (!client || clientKey !== apiKey) {
        client = new GoogleGenAI({ apiKey });
        clientKey = apiKey;
    }
    return client;
};

export const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const geminiModel = () => process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

// An answer we can't use at all. Same code as InvalidReviewerOutput, so it's asked again.
const unusable = (message) => Object.assign(new Error(message), { code: 'invalid_output' });

// The only kinds of file we send along with a prompt: pictures and PDFs. Anything else is a bug here.
const FILE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);

// The prompt alone, or one user turn with the files first and the prompt last. A file's bytes are
// turned into base64 only here, so only the call being made holds the larger copy.
const contentsOf = (prompt, files) => {
    if (!files.length) return prompt;
    for (const { mimeType, data } of files) {
        if (!FILE_TYPES.has(mimeType) || !Buffer.isBuffer(data)) throw new TypeError(`Can't send ${mimeType} to Gemini.`);
    }
    const parts = files.map(({ mimeType, data }) => ({ inlineData: { mimeType, data: data.toString('base64') } }));
    return [{ role: 'user', parts: [...parts, { text: prompt }] }];
};

// Asks for JSON that follows `schema` and returns it parsed. `files` is [{ mimeType, data: Buffer }].
// Throws on API errors (their `status` is kept, so callers can tell a busy quota (429) from a bad
// request) and on an empty or cut-off answer, or one that isn't valid JSON.
export const generateJson = async ({ system, prompt, schema, temperature = 0.4, files = [] }) => {
    const model = geminiModel();
    const contents = contentsOf(prompt, files);
    const response = await getClient().models.generateContent({
        model,
        contents,
        config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            temperature,
            httpOptions: { timeout: geminiSettings.timeoutMs },
        },
    });

    const text = response.text;
    const finish = response.candidates?.[0]?.finishReason;
    if (!text) throw unusable(`Gemini returned an empty response${finish ? ` (${finish})` : ''}.`);
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw unusable(`Gemini returned something that is not valid JSON${finish ? ` (${finish})` : ''}.`);
    }
    return { data, model: response.modelVersion || model };
};
