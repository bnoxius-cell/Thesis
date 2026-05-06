// server/utils/emailService.js
import transporter from '../config/nodemailer.js';

// --- THE TAILWIND-STYLE WRAPPER ---
// This keeps your code DRY. It wraps your dynamic content in a professional, centered card.
const baseHtmlTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center">
                <div style="max-width: 500px; background-color: #ffffff; padding: 40px 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-align: left; border-top: 4px solid #3b82f6;">
                    ${content}
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                        This is an automated message from Resourcery. Please do not reply to this email.
                    </p>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
`;

// --- EMAIL CONTROLLERS ---

export const sendWelcomeEmail = async (email) => {
    const content = `
        <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 24px; font-weight: 600;">Welcome to Resourcery</h2>
        <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5;">
            Your account has been successfully created. Resourcery is designed to provide you with secure, reliable tools for your stress management journey.
        </p>
        <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.5;">
            You can now log in to access your dashboard and begin setting up your profile.
        </p>
    `;

    await transporter.sendMail({
        from: `"Resourcery" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: 'Welcome to Resourcery',
        html: baseHtmlTemplate(content)
    });
};

export const sendVerifyEmailOtp= async (email, otp) => {
    const content = `
        <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 24px; font-weight: 600;">Verify your email address</h2>
        <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5;">
            Please use the verification code below to confirm your account. This code is valid for 20 minutes.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; color: #1e293b; letter-spacing: 12px; margin-left: 12px;">${otp}</span>
        </div>

        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
            If you did not request this code, you can safely ignore this email.
        </p>
    `;

    await transporter.sendMail({
        from: `"Resourcery Support" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: 'Verify your email address',
        html: baseHtmlTemplate(content)
    });
};

export const sendPasswordResetEmail = async (email, otp) => {
    const content = `
        <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 24px; font-weight: 600;">Password reset request</h2>
        <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5;">
            We received a request to reset the password for your account. Please use the code below to proceed. This code will expire in 20 minutes.
        </p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; color: #1e293b; letter-spacing: 12px; margin-left: 12px;">${otp}</span>
        </div>

        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
            If you did not request a password reset, please ignore this email. Your account remains secure.
        </p>
    `;

    await transporter.sendMail({
        from: `"Resourcery Security" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: 'Password reset request',
        html: baseHtmlTemplate(content)
    });
};

export const sendPasswordResetSuccessEmail = async (email) => {
    const content = `
        <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 24px; font-weight: 600;">Password successfully updated</h2>
        <p style="margin: 0 0 24px 0; color: #475569; font-size: 16px; line-height: 1.5;">
            This email is to confirm that the password for your Resourcery account has been successfully changed.
        </p>
        <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.5;">
            If you made this change, no further action is required. If you did not authorize this change, please contact support immediately.
        </p>
    `;

    await transporter.sendMail({
        from: `"Resourcery Security" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: 'Password successfully updated',
        html: baseHtmlTemplate(content)
    });
};