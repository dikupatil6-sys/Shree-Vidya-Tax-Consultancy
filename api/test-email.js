const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { RECIPIENT_EMAIL, sendEmail } = require('../server/email');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const hasResend = !!process.env.RESEND_API_KEY;
    const hasGmail = !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS;

    if (!hasResend && !hasGmail) {
        return res.status(500).json({
            ok: false,
            error: 'No sender configured. Set RESEND_API_KEY or EMAIL_USER/EMAIL_PASS in Vercel env vars.'
        });
    }

    try {
        const result = await sendEmail({
            to: RECIPIENT_EMAIL,
            subject: 'Test Email from Cyber Cafe Website',
            html: '<p>If you received this, email is working correctly!</p>'
        });
        res.status(200).json({
            ok: true,
            message: 'Test email sent successfully',
            provider: result.provider,
            recipient: RECIPIENT_EMAIL
        });
    } catch (err) {
        console.error('Test email failed:', err.message);
        res.status(500).json({ ok: false, error: 'Email test failed: ' + err.message });
    }
};
