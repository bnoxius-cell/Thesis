import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

vi.mock('../utils/emailService.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendVerifyEmailOtp: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetSuccessEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/googleAuth.js', () => ({
    verifyGoogleIdToken: vi.fn(),
}));

import { sendPasswordResetEmail, sendPasswordResetSuccessEmail } from '../utils/emailService.js';
import { verifyGoogleIdToken } from '../utils/googleAuth.js';
import { generateOtp } from '../utils/generateOtp.js';
import { backfillPasswordSet } from '../scripts/backfillPasswordSet.js';
import app from '../app.js';
import userModel from '../models/userModel.js';
import { connectTestDB, clearTestDB, closeTestDB } from './helpers/testDb.js';
import { validRegisterPayload } from './helpers/fixtures.js';

const EMAIL = 'test.student@student.fatima.edu.ph';
const GOOGLE_EMAIL = 'google.student@gmail.com';

beforeAll(connectTestDB);
beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
});
afterAll(closeTestDB);

const cookieOf = (user) => `token=${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET)}`;

const googleSignUp = async () => {
    verifyGoogleIdToken.mockResolvedValue({
        getPayload: () => ({ name: 'Google Student', sub: 'google-id-1', picture: '', email_verified: true, email: GOOGLE_EMAIL }),
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/google').send({ token: 'valid-token' });
    return agent;
};

const requestResetCode = async (agent, email) => {
    const res = await agent.post('/api/auth/send-reset-otp').send({ email });
    expect(res.body.success).toBe(true);
    return (await userModel.findOne({ email })).resetPasswordOtp;
};

const resetWith = (agent, email, otp, password = 'NewPassword456') =>
    agent.post('/api/auth/reset-password').send({ email, otp, password });

const hasPassword = async (agent) => (await agent.get('/api/user/data')).body.userData.hasPassword;

describe('passwordSet and hasPassword', () => {
    test('email sign-up sets passwordSet, and hasPassword follows it', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());

        expect((await userModel.findOne({ email: EMAIL })).passwordSet).toBe(true);
        expect(await hasPassword(agent)).toBe(true);
    });

    test('Google sign-up leaves passwordSet false, so hasPassword is false', async () => {
        const agent = await googleSignUp();

        const user = await userModel.findOne({ email: GOOGLE_EMAIL });
        expect(user.password).not.toBe(''); // the random hash is still stored
        expect(user.passwordSet).toBe(false);
        expect(await hasPassword(agent)).toBe(false);
    });

    test('hasPassword reads passwordSet, not whether a hash exists', async () => {
        const user = await userModel.create({ name: 'Old Student', email: EMAIL, password: await bcrypt.hash('Password123', 10) });
        const res = await request(app).get('/api/user/data').set('Cookie', cookieOf(user));
        expect(res.body.userData.hasPassword).toBe(false);
    });

    test('a successful reset sets passwordSet', async () => {
        const user = await userModel.create({ name: 'Old Student', email: EMAIL, password: await bcrypt.hash('Password123', 10) });
        const otp = await requestResetCode(request(app), EMAIL);

        const res = await resetWith(request(app), EMAIL, otp);

        expect(res.body.success).toBe(true);
        expect((await userModel.findById(user._id)).passwordSet).toBe(true);
    });

    test('/api/user/data exposes isAccountVerified and authProvider', async () => {
        const agent = await googleSignUp();
        const { userData } = (await agent.get('/api/user/data')).body;
        expect(userData.isAccountVerified).toBe(true);
        expect(userData.authProvider).toBe('google');
    });
});

describe('setting a first password on a Google-only account', () => {
    test('the cookie alone never sets a password', async () => {
        const agent = await googleSignUp();
        const before = (await userModel.findOne({ email: GOOGLE_EMAIL })).password;

        const noCode = await agent.post('/api/auth/reset-password').send({ email: GOOGLE_EMAIL, password: 'NewPassword456' });
        const noCodeIssued = await resetWith(agent, GOOGLE_EMAIL, '123456');
        await agent.put('/api/user/profile').send({ password: 'NewPassword456', passwordSet: true });

        expect(noCode.body.success).toBe(false);
        expect(noCodeIssued.body.success).toBe(false);
        const after = await userModel.findOne({ email: GOOGLE_EMAIL });
        expect(after.password).toBe(before);
        expect(after.passwordSet).toBe(false);
    });

    test('works with the emailed code, then the new password signs in', async () => {
        const agent = await googleSignUp();
        const otp = await requestResetCode(agent, GOOGLE_EMAIL);
        expect(sendPasswordResetEmail).toHaveBeenCalledWith(GOOGLE_EMAIL, otp);

        const res = await resetWith(agent, GOOGLE_EMAIL, otp);

        expect(res.body.success).toBe(true);
        expect(sendPasswordResetSuccessEmail).toHaveBeenCalledTimes(1);
        expect(await hasPassword(agent)).toBe(true);
        const login = await request(app).post('/api/auth/login').send({ email: GOOGLE_EMAIL, password: 'NewPassword456' });
        expect(login.body.success).toBe(true);
    });

    test('a wrong code fails and changes nothing', async () => {
        const agent = await googleSignUp();
        const otp = await requestResetCode(agent, GOOGLE_EMAIL);
        const wrong = otp === '111111' ? '222222' : '111111';

        const res = await resetWith(agent, GOOGLE_EMAIL, wrong);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/isn't right/i);
        expect((await userModel.findOne({ email: GOOGLE_EMAIL })).passwordSet).toBe(false);
    });

    test('an expired code fails', async () => {
        const agent = await googleSignUp();
        const otp = await requestResetCode(agent, GOOGLE_EMAIL);
        await userModel.updateOne({ email: GOOGLE_EMAIL }, { resetPasswordOtpExpireAt: Date.now() - 1000 });

        const res = await resetWith(agent, GOOGLE_EMAIL, otp);

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/expired/i);
        expect((await userModel.findOne({ email: GOOGLE_EMAIL })).passwordSet).toBe(false);
    });

    test('a code works only once', async () => {
        const agent = await googleSignUp();
        const otp = await requestResetCode(agent, GOOGLE_EMAIL);
        expect((await resetWith(agent, GOOGLE_EMAIL, otp)).body.success).toBe(true);

        const reused = await resetWith(agent, GOOGLE_EMAIL, otp, 'AnotherPassword789');

        expect(reused.body.success).toBe(false);
        const user = await userModel.findOne({ email: GOOGLE_EMAIL });
        expect(await bcrypt.compare('NewPassword456', user.password)).toBe(true);
    });

    test('a two-way race on one code lets only one request through', async () => {
        await googleSignUp();
        const otp = await requestResetCode(request(app), GOOGLE_EMAIL);

        const results = await Promise.all([
            resetWith(request(app), GOOGLE_EMAIL, otp, 'FirstPassword111'),
            resetWith(request(app), GOOGLE_EMAIL, otp, 'SecondPassword222'),
        ]);

        expect(results.filter((res) => res.body.success)).toHaveLength(1);
    });
});

describe('changing a password', () => {
    const localAgent = async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());
        return agent;
    };

    test('needs the emailed code', async () => {
        const agent = await localAgent();
        await requestResetCode(agent, EMAIL);

        const res = await agent.post('/api/auth/reset-password').send({ email: EMAIL, password: 'NewPassword456' });

        expect(res.body.success).toBe(false);
        const user = await userModel.findOne({ email: EMAIL });
        expect(await bcrypt.compare('Password123', user.password)).toBe(true);
    });

    test('rejects a new password under 8 characters, or one that is not text', async () => {
        const agent = await localAgent();
        const otp = await requestResetCode(agent, EMAIL);

        const short = await resetWith(agent, EMAIL, otp, 'short');
        const notText = await resetWith(agent, EMAIL, otp, { length: 20 });

        expect(short.body.success).toBe(false);
        expect(short.body.message).toMatch(/at least 8/i);
        expect(notText.body.success).toBe(false);
        // Validation runs before the code is checked, so the code is still good.
        expect((await resetWith(agent, EMAIL, otp)).body.success).toBe(true);
    });

    test('five wrong codes burn the code, so the right one stops working', async () => {
        const agent = await localAgent();
        const otp = await requestResetCode(agent, EMAIL);
        const wrong = otp === '111111' ? '222222' : '111111';

        const answers = [];
        for (let i = 0; i < 5; i++) answers.push((await resetWith(agent, EMAIL, wrong)).body.message);

        answers.slice(0, 4).forEach((message) => expect(message).toMatch(/isn't right/i));
        expect(answers[4]).toMatch(/too many wrong tries/i);
        expect((await resetWith(agent, EMAIL, otp)).body.success).toBe(false);
    });

    test('parallel wrong guesses can not get past the limit', async () => {
        const agent = await localAgent();
        const otp = await requestResetCode(agent, EMAIL);
        const wrong = otp === '111111' ? '222222' : '111111';

        await Promise.all(Array.from({ length: 12 }, () => resetWith(request(app), EMAIL, wrong)));

        expect((await resetWith(agent, EMAIL, otp)).body.success).toBe(false);
    });

    test('a new code resets the wrong-guess count', async () => {
        const agent = await localAgent();
        const first = await requestResetCode(agent, EMAIL);
        const wrong = first === '111111' ? '222222' : '111111';
        for (let i = 0; i < 4; i++) await resetWith(agent, EMAIL, wrong);

        const second = await requestResetCode(agent, EMAIL);

        expect((await userModel.findOne({ email: EMAIL })).resetPasswordOtpAttempts).toBe(0);
        expect((await resetWith(agent, EMAIL, second)).body.success).toBe(true);
    });

    test('a failed code email answers with a plain message', async () => {
        await localAgent();
        sendPasswordResetEmail.mockRejectedValueOnce(new Error('smtp detail'));
        vi.spyOn(console, 'error').mockImplementationOnce(() => {});

        const res = await request(app).post('/api/auth/send-reset-otp').send({ email: EMAIL });

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/couldn't send/i);
        expect(JSON.stringify(res.body)).not.toContain('smtp detail');
    });

    test('a failed "password changed" email still reports success', async () => {
        const agent = await localAgent();
        const otp = await requestResetCode(agent, EMAIL);
        sendPasswordResetSuccessEmail.mockRejectedValueOnce(new Error('smtp detail'));
        vi.spyOn(console, 'error').mockImplementationOnce(() => {});

        const res = await resetWith(agent, EMAIL, otp);

        expect(res.body.success).toBe(true);
    });
});

describe('verify email from the Account tab', () => {
    test('isAccountVerified goes from false to true with the emailed code', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());
        expect((await agent.get('/api/user/data')).body.userData.isAccountVerified).toBe(false);

        await agent.post('/api/auth/send-verify-otp').send({});
        const { verifyEmailOtp } = await userModel.findOne({ email: EMAIL });
        const res = await agent.post('/api/auth/verify-email').send({ otp: verifyEmailOtp });

        expect(res.body.success).toBe(true);
        expect((await agent.get('/api/user/data')).body.userData.isAccountVerified).toBe(true);
    });

    test('five wrong codes burn the verification code too', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());
        const { verifyEmailOtp } = await userModel.findOne({ email: EMAIL });
        const wrong = verifyEmailOtp === '111111' ? '222222' : '111111';

        for (let i = 0; i < 5; i++) await agent.post('/api/auth/verify-email').send({ otp: wrong });
        const res = await agent.post('/api/auth/verify-email').send({ otp: verifyEmailOtp });

        expect(res.body.success).toBe(false);
        expect((await userModel.findOne({ email: EMAIL })).isAccountVerified).toBe(false);
    });
});

describe('code checks', () => {
    const localAgent = async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(validRegisterPayload());
        return agent;
    };
    const verifyWith = (agent, otp) => agent.post('/api/auth/verify-email').send({ otp });

    test('a verify code does not work for reset, and a reset code does not work for verify', async () => {
        const agent = await localAgent();
        await userModel.updateOne({ email: EMAIL }, {
            verifyEmailOtp: '111111', verifyEmailOtpExpireAt: Date.now() + 60000,
            resetPasswordOtp: '222222', resetPasswordOtpExpireAt: Date.now() + 60000,
        });

        expect((await resetWith(agent, EMAIL, '111111')).body.success).toBe(false);
        expect((await verifyWith(agent, '222222')).body.success).toBe(false);

        const user = await userModel.findOne({ email: EMAIL });
        expect(user.isAccountVerified).toBe(false);
        expect(await bcrypt.compare('Password123', user.password)).toBe(true);
        // each code still works for its own purpose
        expect((await verifyWith(agent, '111111')).body.success).toBe(true);
        expect((await resetWith(agent, EMAIL, '222222')).body.success).toBe(true);
    });

    test('four wrong guesses, then the right code on the fifth still works', async () => {
        const agent = await localAgent();
        const otp = await requestResetCode(agent, EMAIL);
        const wrong = otp === '111111' ? '222222' : '111111';
        for (let i = 0; i < 4; i++) await resetWith(agent, EMAIL, wrong);

        expect((await resetWith(agent, EMAIL, otp)).body.success).toBe(true);
    });

    test('a burst of guesses that includes the right code accepts it at most once and counts attempts', async () => {
        const agent = await localAgent();
        const otp = await requestResetCode(agent, EMAIL);
        const wrong = otp === '111111' ? '222222' : '111111';
        const guesses = [wrong, wrong, otp, wrong, otp, wrong];

        const results = await Promise.all(guesses.map((guess) => resetWith(request(app), EMAIL, guess)));

        expect(results.filter((res) => res.body.success).length).toBeLessThanOrEqual(1);
        const user = await userModel.findOne({ email: EMAIL });
        // either the code was used (count reset) or the guesses were counted, never lost
        expect(user.resetPasswordOtp === '' || user.resetPasswordOtpAttempts > 0).toBe(true);
    });
});

describe('login messages', () => {
    const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

    test('a user document with no passwordSet field can still log in', async () => {
        await userModel.collection.insertOne({
            name: 'Old Student', email: EMAIL, password: await bcrypt.hash('Password123', 10), authProvider: 'local', isAccountVerified: true,
        });

        expect((await login(EMAIL, 'Password123')).body.success).toBe(true);
    });

    test('a Google account that set a password gets the plain wrong-password message', async () => {
        await googleSignUp();
        await userModel.updateOne({ email: GOOGLE_EMAIL }, { passwordSet: true });

        const res = await login(GOOGLE_EMAIL, 'WrongPassword1');

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/incorrect password/i);
    });

    test('a Google account with no password set is pointed to Google', async () => {
        await googleSignUp();

        const res = await login(GOOGLE_EMAIL, 'WrongPassword1');

        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/google sign-in/i);
    });
});

describe('generateOtp', () => {
    test('gives six digits', () => {
        for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^[1-9]\d{5}$/);
    });
});

describe('backfillPasswordSet script', () => {
    const seed = async () => {
        const hash = await bcrypt.hash('Password123', 10);
        await userModel.collection.insertMany([
            { name: 'Local A', email: 'a@example.com', password: hash, authProvider: 'local' },
            { name: 'Local B', email: 'b@example.com', password: hash }, // from before authProvider existed
            { name: 'Google C', email: 'c@example.com', password: hash, authProvider: 'google' },
            { name: 'Done D', email: 'd@example.com', password: hash, authProvider: 'local', passwordSet: true },
        ]);
    };
    const flags = async () => Object.fromEntries(
        (await userModel.collection.find().toArray()).map((u) => [u.name, u.passwordSet === true])
    );

    test('a dry run counts and changes nothing', async () => {
        await seed();

        const result = await backfillPasswordSet();

        expect(result).toEqual({ matched: 2, googleSkipped: 1, updated: 0 });
        expect(await flags()).toEqual({ 'Local A': false, 'Local B': false, 'Google C': false, 'Done D': true });
    });

    test('--apply sets passwordSet on local accounts only', async () => {
        await seed();

        const result = await backfillPasswordSet({ apply: true });

        expect(result.updated).toBe(2);
        expect(await flags()).toEqual({ 'Local A': true, 'Local B': true, 'Google C': false, 'Done D': true });
    });
});
