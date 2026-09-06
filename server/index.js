const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const { RECIPIENT_EMAIL, sendEmail, buildEmailHtml } = require('./email');

const app = express();
const PORT = process.env.PORT || 3010;

console.log('Email Config Check:');
console.log('User:', process.env.EMAIL_USER ? 'Set' : 'Not Set');
console.log('Pass:', process.env.EMAIL_PASS ? 'Set' : 'Not Set');
console.log('Recipient:', RECIPIENT_EMAIL ? 'Set' : 'Not Set');
console.log('Resend API key:', process.env.RESEND_API_KEY ? 'Set' : 'Not Set');
console.log('Mongo:', process.env.MONGO_URI ? 'Set' : 'Not Set');

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['Content-Type', 'Content-Length']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, '..')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Configure Nodemailer (Gmail fallback)
// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cyber_cafe_db';
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 2000 })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err.message));

// Define Mongoose Schema
const submissionSchema = new mongoose.Schema({
    name: String,
    phone: String,
    email: String,
    service: String,
    notes: String,
    files: [String], // Array of file paths
    createdAt: { type: Date, default: Date.now }
});

const Submission = mongoose.model('Submission', submissionSchema);

// Routes
app.get('/api/health', (req, res) => {
    res.send('Cyber Cafe Backend is Running!');
});

// Test email endpoint to verify configuration
app.get('/api/test-email', async (req, res) => {
    console.log('\n=== EMAIL TEST ===');
    console.log('Recipient:', RECIPIENT_EMAIL);
    const hasResend = !!process.env.RESEND_API_KEY;
    console.log('Sender mechanism:', hasResend ? 'Resend' : 'Gmail SMTP');

    if (!hasResend && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
        return res.json({ ok: false, error: 'No sender configured. Add RESEND_API_KEY or EMAIL_USER/EMAIL_PASS in .env' });
    }

    try {
        const info = await sendEmail({
            to: RECIPIENT_EMAIL,
            subject: 'Test Email from Cyber Cafe Website',
            html: '<p>If you received this, email is working correctly!</p>'
        });
        console.log('✅ Test email sent successfully');
        res.json({ ok: true, message: 'Test email sent successfully', sender: hasResend ? 'Resend' : 'Gmail', info });
    } catch (err) {
        console.error('❌ Email test failed:', err.message);
        res.json({ ok: false, error: 'Email test failed: ' + err.message, code: err.code || null });
    }
});

app.post('/api/submit', upload.array('files'), async (req, res) => {
    try {
        const { name, phone, email, notes, service } = req.body;
        const files = req.files || [];

        console.log('=== NEW SUBMISSION ===');
        console.log('Name:', name);
        console.log('Phone:', phone);
        console.log('Email:', email);
        console.log('Service:', service);
        console.log('Notes:', notes);
        console.log('Files received:', files.length);
        if (files.length > 0) {
            files.forEach((f, i) => console.log(`  File ${i}: ${f.originalname} (${f.size} bytes)`));
        }

        // Save to MongoDB (only if connected - never block the request waiting on DB)
        if (mongoose.connection.readyState === 1) {
            try {
                const filePaths = files.map(f => f.path);
                const newSubmission = new Submission({
                    name,
                    phone,
                    email,
                    service,
                    notes,
                    files: filePaths
                });
                await newSubmission.save();
                console.log('✅ Saved to MongoDB');
            } catch (dbErr) {
                console.error('❌ Failed to save to database:', dbErr.message);
                // Don't fail the request just because DB failed, if email is what matters most
            }
        } else {
            console.warn('Skipping DB save (MongoDB not connected)');
        }

        // Prepare email attachments (disk-stored files from multer)
        const attachments = files.map(file => ({
            originalname: file.originalname,
            path: file.path
        }));

        // Send Email (Graceful Fallback: Resend preferred, Gmail fallback)
        let emailSent = false;
        let emailError = null;
        let emailProvider = null;

        try {
            const result = await sendEmail({
                to: RECIPIENT_EMAIL,
                subject: `New Service Request: ${service} - ${name}`,
                html: buildEmailHtml({ name, phone, email, service, notes, fileCount: files.length }),
                attachments
            });
            console.log('Email sent successfully');
            emailSent = true;
            emailProvider = result.provider;
        } catch (err) {
            console.error('Failed to send email:', err.message);
            emailError = 'Email failed: ' + err.message;
        }
        
        // Return success even if email failed (files are saved locally)
        const responseData = { 
            ok: true, 
            message: emailSent ? `Submission received and sent via ${emailProvider || 'email'}` : 'Submission saved locally (Email notification skipped)',
            warning: emailError,
            data: {
                name,
                phone,
                email,
                service,
                fileCount: files.length
            }
        };
        console.log('Sending success response:', JSON.stringify(responseData));
        res.json(responseData);
    } catch (error) {
        console.error('❌ Error processing submission:', error.message);
        console.error('Stack:', error.stack);
        const errorResponse = { 
            ok: false, 
            error: 'Internal server error: ' + error.message 
        };
        console.log('Sending error response:', JSON.stringify(errorResponse));
        res.status(500).json(errorResponse);
    }
});

// Fallback for SPA or just redirect to index.html if not found
app.get(/.*/, (req, res) => {
    // If it's an API call that failed, don't return HTML
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not Found' });
    }
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving frontend from ${path.join(__dirname, '..')}`);
});
