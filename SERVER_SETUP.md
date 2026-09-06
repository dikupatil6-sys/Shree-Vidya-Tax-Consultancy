# Server Setup & Startup Guide

## Prerequisites

- **Node.js** installed (v14 or higher)
- **MongoDB** running locally (optional - data will be saved locally if MongoDB is unavailable)
- **Gmail App Password** configured (see below)

## Environment Configuration

Keep credentials only in local `.env` files. For Vercel, add the same email
variables in the Vercel project settings instead of uploading `.env` files.

### Email Sending (Resend recommended)

The server can send email two ways. **Resend is the recommended, reliable sender** — it delivers to any inbox (including Gmail) without the impersonation/security restrictions Gmail app passwords have.

1. Sign up free at https://resend.com
2. In your Resend dashboard, create an **API Key** (e.g. `re_...`)
3. Set it in `.env` (both root and `server/.env`):
   ```
   RESEND_API_KEY=re_xxxxxxxx
   RESEND_FROM=Cyber Cafe <onboarding@resend.dev>
   ```
4. For a real sender name, verify a domain in Resend and update `RESEND_FROM` (e.g. `Cyber Cafe <no-reply@yourdomain.com>`). Until then `onboarding@resend.dev` works for testing.

When `RESEND_API_KEY` is empty, the server silently falls back to Gmail SMTP using `EMAIL_USER`/`EMAIL_PASS`.

### Email Recipient (Where to send submissions)

All form submissions are emailed to the address in `RECIPIENT_EMAIL`:

```
RECIPIENT_EMAIL=Sumittandel7@gmail.com
```

Update this value in `.env` (both the root and `server/.env`) to change which inbox receives the submissions.

### Gmail Setup (Fallback Only)

The system can also use Gmail with App Passwords (fallback when Resend is not configured).

The system uses Gmail with App Passwords. If you need to update:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification
3. Search for "App Passwords"
4. Generate an app password for "Mail"
5. Update `EMAIL_PASS` in `.env`

## Starting the Server

### Option 1: From PowerShell

```powershell
cd "c:\Users\acer\OneDrive\Desktop\cyber-cafe-website\server"
npm start
```

The server will start on **http://localhost:3010**

### Option 2: Automated Startup

Run the provided startup script:
```powershell
cd "c:\Users\acer\OneDrive\Desktop\cyber-cafe-website"
.\start-server.ps1
```

## What Happens During Startup

✅ **Server**: Starts on port 3010  
✅ **Frontend**: Served on http://localhost:3010  
✅ **CORS**: Enabled for all origins  
⚠️ **MongoDB**: Connection attempted (continues running if unavailable)  
📧 **Email**: Gmail notifications enabled  

## Testing the Server

```powershell
# Test if server is responding
Invoke-WebRequest http://localhost:3010/api/health
```

## Form Submission Flow

1. User fills out form in modal (Name, Phone, Email, Message, File)
2. Frontend sends POST request to `/api/submit`
3. Backend processes the request:
   - ✅ Saves form data to MongoDB (if available)
   - ✅ Sends email notification to owner
   - ✅ Stores uploaded files in `server/uploads/`
4. User receives success confirmation

## Troubleshooting

### "Failed to fetch" Error
- **Problem**: Server not running or unreachable
- **Solution**: Start the server with `npm start`

### MongoDB Connection Error
- **Problem**: MongoDB service not running
- **Solution**: This is non-critical - form submissions still work locally
- **To fix**: Install and run MongoDB, or update `MONGO_URI` in `.env`

### Email Not Sending
- **Problem**: Submission received but no email arrived
- **Solution**:
  1. Set a valid `RESEND_API_KEY` in `.env` (recommended) and restart the server
  2. If using Gmail fallback: verify `EMAIL_PASS` in `.env` is correct, 2-Factor Authentication is enabled, and the App Password matches the `EMAIL_USER` account
  3. Test with `http://localhost:3010/api/test-email`

### Port Already in Use
- **Problem**: Port 3010 is already in use
- **Solution**: Update `PORT` in `server/index.js` and in `.env`

## File Upload Location

Uploaded files are stored in: `server/uploads/`

Files are named with timestamp + random suffix for uniqueness.

## Next Steps

✅ Server is running - form submissions should now work!  
📧 Email notifications will be sent to the address configured in `RECIPIENT_EMAIL` (currently Sumittandel7@gmail.com)  
💾 Form data will be saved locally if MongoDB is available
