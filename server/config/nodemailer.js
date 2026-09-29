import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_NAME,
        pass: process.env.SMTP_PASSWORD
    },
    // Nodemailer waits up to 2 minutes for a connection by default. Where SMTP is
    // blocked (e.g. Render's free tier) that left the "Resend Code" request hanging,
    // so give up quickly and let the caller report the failure.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
})

export default transporter;