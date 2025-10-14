# Password Reset Flow

This document summarizes the end-to-end password reset capability in Stato.

## Overview
Users who forget their password can request a reset email. The email contains a time-limited token (purpose = `reset`) that allows setting a new password without being logged in.

## User Journey
1. Navigate to the login page and click "Passwort vergessen?" → routed to `/reset-request`.
2. Enter email and submit.
3. Backend sends an email with a link: `${APP_ORIGIN}/reset-password?token=<token>`.
4. User opens link, enters new password twice, submits.
5. On success, UI shows confirmation with a direct Login link.

## Backend Endpoints (AuthController)
- `POST /auth/request-password-reset` body: `{ email: string }`
  - Generates a reset token (`purpose: 'reset'`) if user exists.
  - Always returns 200 (ambiguous response) to avoid email enumeration.
- `POST /auth/reset-password` body: `{ token: string, password: string }`
  - Validates token purpose + expiration, updates password, invalidates token.
- `POST /auth/admin-reset-password` (restricted) for administrators to directly set a password.

## Token Behavior
- Stored with purpose (`invite` vs `reset`) and expiration (`RESET_TOKEN_EXPIRATION`).
- Single use; after successful reset it's invalidated.
- Expiration default (example): 1h. Configure via env.

## Email Service
Uses Nodemailer with SMTP configuration when `SMTP_HOST` is present; otherwise logs to console.
Email variables:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `APP_ORIGIN` used to build reset link

## Environment Variables
Add (or confirm) the following in your `.env` / deployment secrets:
```
APP_ORIGIN=https://app.example.com
RESET_TOKEN_EXPIRATION=3600            # seconds
INVITE_TOKEN_EXPIRATION=604800         # seconds (7 days)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_user
SMTP_PASS=your_password
SMTP_FROM=Stato <no-reply@example.com>
```
If using Mittwald:
```
SMTP_HOST=mx01.mittwald.de  # or host provided in panel
SMTP_PORT=587               # STARTTLS submission
SMTP_USER=hosting-account@yourdomain.de
SMTP_PASS=********
SMTP_FROM=Stato <support@yourdomain.de>
```

## Security Notes
- Ambiguous response on request avoids disclosing user existence.
- Tokens are purpose-scoped to prevent using invite tokens to reset passwords.
- Recommend enabling rate limiting (not yet implemented) on `/auth/request-password-reset`.
- Encourage strong passwords (client-side validation; server-side minimum length enforced by service logic).

## UX Enhancements
- Added direct "Login" links on both the request confirmation state and the reset form for easy navigation.
- All messages in German for production parity.

## Operational Checklist
- Ensure cron / worker not required (synchronous send).
- Monitor SMTP delivery logs in Mittwald panel for bounces.
- Add DKIM/SPF records for `SMTP_FROM` domain to reduce spam filtering.

## Future Improvements
- Rate limiting (IP + email) using Redis or in-memory bucket.
- Optional CAPTCHA after multiple failed attempts.
- HTML email template theming.
- Add audit logging entry on successful password reset.

## Test Commands (Dev)
Trigger request:
```
curl -X POST http://localhost:4000/auth/request-password-reset -H "Content-Type: application/json" -d '{"email":"user@example.com"}'
```
Use returned email token (from Mailpit) to reset:
```
curl -X POST http://localhost:4000/auth/reset-password -H "Content-Type: application/json" -d '{"token":"<token>","password":"NewStrong1!"}'
```

## Troubleshooting
- No email received: verify SMTP creds, check Mittwald log, inspect container env values.
- Token invalid/expired: ensure clocks synced and expiration not too short.
- 500 errors: check `email.service.ts` for transporter configuration; enable debug logging by temporarily setting `NODE_ENV=development`.
