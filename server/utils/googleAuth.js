import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Thin wrapper around google-auth-library so authController.js has a small,
// local seam to mock in tests instead of the third-party package itself.
export const verifyGoogleIdToken = (idToken) =>
    client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
