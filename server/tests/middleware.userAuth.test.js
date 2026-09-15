import { describe, test, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import userAuth from '../middleware/userAuth.js';

// Unit-level test: exercises the middleware function directly against mock
// req/res/next, with no HTTP layer and no database — fast and pins down
// exactly what userAuth does in isolation from everything that uses it.
const mockRes = () => {
    const res = {};
    res.json = vi.fn().mockReturnValue(res);
    return res;
};

describe('userAuth middleware', () => {
    test('rejects a request with no token cookie', async () => {
        const req = { cookies: {} };
        const res = mockRes();
        const next = vi.fn();

        await userAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
    });

    test('rejects an invalid/garbage token', async () => {
        const req = { cookies: { token: 'not-a-real-jwt' } };
        const res = mockRes();
        const next = vi.fn();

        await userAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    test('rejects a validly-signed token whose payload has no id', async () => {
        const token = jwt.sign({ notAnId: 'whatever' }, process.env.JWT_SECRET);
        const req = { cookies: { token } };
        const res = mockRes();
        const next = vi.fn();

        await userAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
    });

    test('accepts a valid token and attaches userId to the request', async () => {
        const token = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);
        const req = { cookies: { token } };
        const res = mockRes();
        const next = vi.fn();

        await userAuth(req, res, next);

        expect(req.userId).toBe('user-123');
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.json).not.toHaveBeenCalled();
    });
});
