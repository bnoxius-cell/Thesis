import { GoogleGenAI } from '@google/genai';

// The only file that talks to the Gemini API. The key stays on the server (GEMINI_API_KEY) and
// never reaches the browser. Tests mock this module instead of the SDK.

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const REQUEST_TIMEOUT_MS = 100000;

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

// Asks for JSON that follows `schema` and returns it parsed. Throws on API errors (their
// `status` is kept, so callers can tell a busy quota (429) from a bad request) and on output
// that isn't valid JSON.
export const generateJson = async ({ system, prompt, schema, temperature = 0.4 }) => {
    const model = geminiModel();
    const response = await getClient().models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            temperature,
            httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        },
    });

    const text = response.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Gemini returned something that is not valid JSON.');
    }
    return { data, model: response.modelVersion || model };
};
