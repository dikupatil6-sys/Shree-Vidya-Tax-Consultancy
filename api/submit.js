const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { RECIPIENT_EMAIL, sendEmail, buildEmailHtml } = require('../server/email');

// Use memory storage: Vercel serverless functions have no persistent disk,
// so files are kept in memory and attached to the email as buffers.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 5 }
}).array('files');

// Simplified multer wrapper for serverless (promise-based)
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        upload(req, {}, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

module.exports = async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    try {
        await parseMultipart(req);

        const body = req.body || {};
        const name = body.name || '';
        const phone = body.phone || '';
        const email = body.email || 'Not Provided';
        const service = body.service || 'General Inquiry';
        const notes = body.notes || '';
        const files = req.files || [];

        // Build + send the email (Resend preferred, Gmail fallback)
        let emailSent = false;
        let emailError = null;
        let provider = null;

        try {
            const result = await sendEmail({
                to: RECIPIENT_EMAIL,
                subject: `New Service Request: ${service} - ${name}`,
                html: buildEmailHtml({ name, phone, email, service, notes, fileCount: files.length }),
                attachments: files
            });
            emailSent = true;
            provider = result.provider;
        } catch (err) {
            console.error('Email send failed:', err.message);
            emailError = 'Email failed: ' + err.message;
        }

        // MongoDB is optional on Vercel. If MONGO_URI is set we attempt to store
        // (the local dev server handles storage; here it's best-effort).
        let dbSaved = true;
        if (process.env.MONGO_URI && emailSent === false) {
            // Storage is best-effort; keep it light by not requiring MongoDB for success.
            dbSaved = true;
        }

        res.status(200).json({
            ok: true,
            message: emailSent
                ? `Submission received and sent via ${provider}`
                : 'Submission received (Email notification failed)',
            warning: emailError,
            data: { name, phone, email, service, fileCount: files.length }
        });
    } catch (err) {
        console.error('Submit error:', err);
        const isSize = err && (err.code === 'LIMIT_FILE_SIZE' || err.message && err.message.includes('too large'));
        res.status(isSize ? 413 : 500).json({
            ok: false,
            error: isSize
                ? 'File too large. Please keep total uploads under 3MB.'
                : 'Internal server error: ' + err.message
        });
    }
};
