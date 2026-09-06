const fs = require('fs');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Email that receives all form submissions (the shop owner / business)
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || 'Sumittandel7@gmail.com';

// Prefer Resend if an API key is provided, otherwise fall back to Gmail SMTP
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Gmail fallback transporter (only created if credentials are provided)
const gmailTransporter = (process.env.EMAIL_USER && process.env.EMAIL_PASS)
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 7000
    })
    : null;

// Normalise an attachment into { filename, content (Buffer) }.
// Supports both memory-storage files ({ originalname, buffer }) and
// disk-storage files ({ originalname, path }).
async function normaliseAttachments(attachments = []) {
    const result = [];
    for (const f of attachments) {
        if (f && f.buffer) {
            result.push({ filename: f.originalname, content: f.buffer });
        } else if (f && f.path && f.path.startsWith('http')) {
            result.push({ filename: f.originalname || f.filename, path: f.path });
        } else if (f && f.path && fs.existsSync(f.path)) {
            result.push({ filename: f.originalname || f.filename, content: fs.readFileSync(f.path) });
        }
    }
    return result;
}

async function sendEmail({ to, subject, html, attachments = [] }) {
    const normalised = await normaliseAttachments(attachments);

    // Guard against hangs: never let an email attempt stall the response forever.
    const withTimeout = (p, ms) => Promise.race([
        p,
        new Promise((_, reject) => setTimeout(
            () => reject(new Error(`Email provider timed out after ${ms}ms`)), ms
        ))
    ]);

    if (resendClient) {
        const res = await withTimeout(resendClient.emails.send({
            from: process.env.RESEND_FROM || 'Cyber Cafe <onboarding@resend.dev>',
            to,
            subject,
            html,
            attachments: normalised
        }), 8000);
        if (res.error) throw new Error('Resend error: ' + res.error.message);
        return { provider: 'resend', id: res.data && res.data.id };
    }

    if (!gmailTransporter) throw new Error('No email provider configured. Add RESEND_API_KEY or EMAIL_USER/EMAIL_PASS');

    const info = await withTimeout(gmailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
        attachments: normalised
    }), 8000);
    return { provider: 'gmail', id: info.messageId };
}

// Nice, structured HTML body for a service request email
function buildEmailHtml({ name, phone, email, service, notes, fileCount }) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #d3e3fb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
                <h2 style="margin: 0; font-size: 24px;">Shree Vidya Tax Consultancy</h2>
                <p style="margin: 5px 0 0; color: #dbeafe;">New Service Request Received</p>
            </div>
            <div style="padding: 24px; background-color: #ffffff; color: #1f1f1f;">
                <p style="margin-top: 0; font-size: 16px;"><strong>Hello,</strong></p>
                <p style="margin-bottom: 24px;">You have received a new service request from the website. Here are the details:</p>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <tr style="background-color: #eef4ff;">
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #575757; width: 40%;"><strong>Service Requested</strong></td>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #111111; font-weight: bold;">${service || ''}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #575757;"><strong>Customer Name</strong></td>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #111111;">${name || ''}</td>
                    </tr>
                    <tr style="background-color: #eef4ff;">
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #575757;"><strong>Mobile Number</strong></td>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #111111;"><a href="tel:${phone || ''}" style="text-decoration: none; color: #111111;">${phone || ''}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #575757;"><strong>Email Address</strong></td>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #111111;"><a href="mailto:${email || ''}" style="text-decoration: none; color: #2563eb;">${email || ''}</a></td>
                    </tr>
                    <tr style="background-color: #eef4ff;">
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #575757;"><strong>Attached Documents</strong></td>
                        <td style="padding: 12px; border-bottom: 1px solid #d3e3fb; color: #111111;">${fileCount || 0} File(s)</td>
                    </tr>
                </table>
                <div style="background-color: #eef4ff; padding: 16px; border-radius: 6px; border-left: 4px solid #2563eb;">
                    <p style="margin: 0 0 8px; color: #575757; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">Additional Message</p>
                    <p style="margin: 0; color: #1f1f1f; line-height: 1.5;">${notes || 'No additional message provided.'}</p>
                </div>
            </div>
            <div style="background-color: #eef4ff; padding: 16px; text-align: center; border-top: 1px solid #d3e3fb; color: #6b93c9; font-size: 12px;">
                <p style="margin: 0;">This is an automated message from your website.</p>
                <p style="margin: 4px 0 0;">&copy; ${new Date().getFullYear()} Shree Vidya Tax Consultancy</p>
            </div>
        </div>
    `;
}

module.exports = { RECIPIENT_EMAIL, sendEmail, buildEmailHtml };
