import { post } from "./http";

// Account security from the Account tab. Every call answers { data } or { error } (a message safe to show).

// Emails a 6-digit code that allows setting or changing the password. It works for any account,
// so a Google-only student can add a first password the same way.
export const sendPasswordCode = (email) => post("/api/auth/send-reset-otp", { email });

// Sets the new password with the emailed code. The session cookie alone is never enough.
export const savePasswordWithCode = (email, otp, password) => post("/api/auth/reset-password", { email, otp, password });

// Emails a 6-digit code to confirm the signed-in student's email, then checks it.
export const sendVerifyCode = () => post("/api/auth/send-verify-otp");
export const verifyEmailWithCode = (otp) => post("/api/auth/verify-email", { otp });
