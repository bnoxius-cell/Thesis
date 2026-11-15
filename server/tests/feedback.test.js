import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import userModel from '../models/userModel.js';
import feedbackModel from '../models/feedbackModel.js';
import { deleteUserData } from '../utils/userData.js';
import { resetRateLimits } from '../utils/rateLimit.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

// Keep the real feedbackEmailHtml and escapeHtml; only the sender must never touch the network.
vi.mock('../utils/emailService.js', async (importOriginal) => ({
    ...(await importOriginal()),
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendFeedbackEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendFeedbackEmail, feedbackEmailHtml } from '../utils/emailService.js';

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    resetRateLimits();
    vi.clearAllMocks();
});
afterEach(() => {
    delete process.env.FEEDBACK_EMAIL;
});
afterAll(closeTestDB);

const signUp = async ({ verified = true } = {}) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validRegisterPayload());
    const { body } = await agent.get('/api/user/data');
    agent.id = body.userData._id;
    if (verified) await userModel.updateOne({ _id: agent.id }, { isAccountVerified: true });
    return agent;
};

const valid = (overrides = {}) => ({
    kind: 'problem',
    message: 'The task list does not scroll on my phone.',
    page: '/plan',
    device: 'phone',
    canContact: true,
    ...overrides,
});

describe('POST /api/feedback', () => {
    test('needs a signed-in student', async () => {
        const res = await request(app).post('/api/feedback').send(valid());

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/unauthorized/i);
        expect(await feedbackModel.countDocuments()).toBe(0);
    });

    test('refuses an unverified account', async () => {
        const agent = await signUp({ verified: false });

        const res = await agent.post('/api/feedback').send(valid());

        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Verify your email first.');
        expect(await feedbackModel.countDocuments()).toBe(0);
    });

    test('saves every field and answers 201', async () => {
        const agent = await signUp();

        const res = await agent.post('/api/feedback').send(valid());

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ success: true });
        const saved = await feedbackModel.findOne().lean();
        expect(saved).toMatchObject({
            kind: 'problem',
            message: 'The task list does not scroll on my phone.',
            page: '/plan',
            device: 'phone',
            canContact: true,
            status: 'new',
        });
        expect(String(saved.user)).toBe(agent.id);
    });

    test('ignores extra body fields and treats canContact as false unless it is true', async () => {
        const agent = await signUp();

        await agent.post('/api/feedback').send(valid({ canContact: 'yes', status: 'done', user: '000000000000000000000000' }));

        const saved = await feedbackModel.findOne().lean();
        expect(saved.canContact).toBe(false);
        expect(saved.status).toBe('new');
        expect(String(saved.user)).toBe(agent.id);
    });

    test('keeps only the path of the page', async () => {
        const agent = await signUp();

        await agent.post('/api/feedback').send(valid({ page: '/plan?x=1#y' }));

        expect((await feedbackModel.findOne().lean()).page).toBe('/plan');
    });

    test.each([
        ['text outside the route alphabet', '/plan/<script>'],
        ['a full URL', 'https://example.com/plan'],
        ['a path that is too long', `/${'a'.repeat(200)}`],
        ['a non-string', { path: '/plan' }],
    ])('stores an empty page for %s', async (_label, page) => {
        const agent = await signUp();

        const res = await agent.post('/api/feedback').send(valid({ page }));

        expect(res.status).toBe(201);
        expect((await feedbackModel.findOne().lean()).page).toBe('');
    });

    test('stores an empty device when it is not one of the three', async () => {
        const agent = await signUp();

        await agent.post('/api/feedback').send(valid({ device: 'fridge' }));

        expect((await feedbackModel.findOne().lean()).device).toBe('');
    });

    test('rejects a bad kind', async () => {
        const agent = await signUp();

        const res = await agent.post('/api/feedback').send(valid({ kind: 'rant' }));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Pick what kind of feedback this is.');
    });

    test.each([
        ['missing', undefined],
        ['not a string', 12345678901],
        ['too short', 'too short'],
        ['only spaces and control characters', '  \u0000\u0007  \n  ........  '],
    ])('rejects a message that is %s', async (_label, message) => {
        const agent = await signUp();

        const res = await agent.post('/api/feedback').send(valid({ message }));

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Tell us a little more (at least 10 characters).');
        expect(await feedbackModel.countDocuments()).toBe(0);
    });

    test('rejects a message over 1,000 characters and accepts exactly 1,000', async () => {
        const agent = await signUp();

        const tooLong = await agent.post('/api/feedback').send(valid({ message: 'a'.repeat(1001) }));
        expect(tooLong.status).toBe(400);
        expect(tooLong.body.message).toBe('Keep it under 1,000 characters.');

        const exact = await agent.post('/api/feedback').send(valid({ message: 'a'.repeat(1000) }));
        expect(exact.status).toBe(201);
    });

    test('strips control characters, trims and squeezes blank lines', async () => {
        const agent = await signUp();

        await agent.post('/api/feedback').send(valid({ message: '  Line one\u0000\u0007 here\n\n\n\n\nLine\ttwo here  ' }));

        expect((await feedbackModel.findOne().lean()).message).toBe('Line one here\n\nLine\ttwo here');
    });

    test('answers 429 to a second post inside 30 seconds', async () => {
        const agent = await signUp();
        await agent.post('/api/feedback').send(valid());

        const res = await agent.post('/api/feedback').send(valid({ message: 'A different thing to say.' }));

        expect(res.status).toBe(429);
        expect(res.body.message).toBe('Give it a moment before sending more.');
        expect(await feedbackModel.countDocuments()).toBe(1);
    });

    test('answers 429 after five in the last 24 hours, but not for older ones', async () => {
        const agent = await signUp();
        const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
        const earlier = (message, createdAt) => ({ ...valid({ message }), user: agent.id, createdAt });
        await feedbackModel.insertMany([
            earlier('Sent yesterday, long ago.', old),
            ...Array.from({ length: 4 }, (_, i) => earlier(`Earlier message number ${i}`, new Date())),
        ]);

        const fifth = await agent.post('/api/feedback').send(valid());
        expect(fifth.status).toBe(201);
        resetRateLimits();

        const sixth = await agent.post('/api/feedback').send(valid({ message: 'One more thought entirely.' }));
        expect(sixth.status).toBe(429);
        expect(sixth.body.message).toMatch(/plenty for today/i);
    });

    test('answers 409 to the same text with other case and spacing', async () => {
        const agent = await signUp();
        await agent.post('/api/feedback').send(valid({ message: 'Please add a dark mode.' }));
        resetRateLimits();

        const res = await agent.post('/api/feedback').send(valid({ message: '  please   ADD a\ndark mode. ' }));

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('You already sent this one. Thanks!');
        expect(await feedbackModel.countDocuments()).toBe(1);
    });

    test('limits are per student', async () => {
        const first = await signUp();
        await first.post('/api/feedback').send(valid());
        const second = request.agent(app);
        await second.post('/api/auth/register').send(validRegisterPayload({ email: 'other@example.com', name: 'Other' }));
        const { body } = await second.get('/api/user/data');
        await userModel.updateOne({ _id: body.userData._id }, { isAccountVerified: true });

        const res = await second.post('/api/feedback').send(valid());

        expect(res.status).toBe(201);
    });

    test('is deleted with the account', async () => {
        const agent = await signUp();
        await agent.post('/api/feedback').send(valid());

        await deleteUserData(agent.id);

        expect(await feedbackModel.countDocuments()).toBe(0);
    });
});

describe('feedback email to the team', () => {
    test('is not sent when FEEDBACK_EMAIL is unset', async () => {
        const agent = await signUp();

        const res = await agent.post('/api/feedback').send(valid());

        expect(res.status).toBe(201);
        expect(sendFeedbackEmail).not.toHaveBeenCalled();
    });

    test('goes to every address in FEEDBACK_EMAIL, read when the request arrives', async () => {
        const agent = await signUp();
        process.env.FEEDBACK_EMAIL = 'one@example.com, two@example.com ,';

        await agent.post('/api/feedback').send(valid());

        await vi.waitFor(() => expect(sendFeedbackEmail).toHaveBeenCalledTimes(2));
        expect(sendFeedbackEmail.mock.calls.map(([mail]) => mail.to)).toEqual(['one@example.com', 'two@example.com']);
        expect(sendFeedbackEmail.mock.calls[0][0]).toMatchObject({
            kind: 'problem',
            page: '/plan',
            device: 'phone',
            canContact: true,
            name: 'Test Student',
            email: 'test.student@student.fatima.edu.ph',
        });
    });

    test('a failing sender does not fail the request', async () => {
        const agent = await signUp();
        process.env.FEEDBACK_EMAIL = 'one@example.com';
        sendFeedbackEmail.mockRejectedValueOnce(new Error('Brevo is down'));
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await agent.post('/api/feedback').send(valid());

        expect(res.status).toBe(201);
        await vi.waitFor(() => expect(logged).toHaveBeenCalled());
        expect(await feedbackModel.countDocuments()).toBe(1);
        logged.mockRestore();
    });
});

describe('feedbackEmailHtml', () => {
    const base = {
        kind: 'idea',
        message: 'Nice <script>alert(1)</script> & "quotes"\nsecond line',
        page: '/plan',
        device: 'desktop',
        name: '<img src=x onerror=alert(1)>',
        email: 'a&b@example.com',
        canContact: true,
        createdAt: new Date('2026-11-15T10:00:00Z'),
    };

    test('escapes every value the student typed', () => {
        const html = feedbackEmailHtml({ ...base, page: '/p"><b>' });

        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img');
        expect(html).not.toContain('<b>');
        expect(html).toContain('&#60;script&#62;');
        expect(html).toContain('Nice &#60;script&#62;alert(1)&#60;/script&#62; &#38; &#34;quotes&#34;<br>second line');
        expect(html).toContain('a&#38;b@example.com');
    });

    test('shows the email only when the student allows contact', () => {
        const hidden = feedbackEmailHtml({ ...base, canContact: false });

        expect(hidden).not.toContain('a&#38;b@example.com');
        expect(hidden).toContain('Not shared');
    });
});
