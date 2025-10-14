# SMTP setup (invite and password reset)

This project uses Nodemailer in the backend to send invite and password reset emails. If SMTP is not configured, links are logged to the backend logs instead of being sent.

## 1) Dev setup with Mailpit

- Start the local SMTP testing server (Mailpit) via docker-compose. A `mailpit` service is included in `docker-compose.yml`.
- Web UI: http://localhost:8025
- SMTP: localhost:1025 (or host `mailpit` and port `1025` if the backend runs in the compose network)

Backend `.env` for local dev:

```
APP_ORIGIN=http://localhost:5173
SMTP_HOST=localhost
SMTP_PORT=1025
# SMTP_USER/SMTP_PASS empty for Mailpit
SMTP_FROM=no-reply@stato.local
```

If you run backend inside compose, use `SMTP_HOST=mailpit` instead of localhost.

## 2) Production SMTP

Pick a provider (e.g., Brevo/Sendinblue, Mailgun, SendGrid, Postmark) and set variables in the backend environment (compose or host):

- SMTP_HOST: e.g., smtp-relay.brevo.com
- SMTP_PORT: 587 (STARTTLS) or 465 (SSL)
- SMTP_USER, SMTP_PASS
- SMTP_FROM: no-reply@yourdomain.tld
- APP_ORIGIN: public app URL used in links inside emails (e.g., https://app.example.org)

Also make sure:

- Proper SPF and DKIM are configured in your DNS for the `SMTP_FROM` domain
- DMARC policy is reasonable
- The address used in SMTP_FROM exists/receives or is a valid sender per provider.

## 3) Testing

- Request a password reset: POST /auth/request-password-reset with `{ email }`
- Or send an invite through the app (superadmin/org admin)
- Verify the email in Mailpit (dev) or at your mailbox (prod).

If emails do not arrive:

- Check backend logs for warnings ("SMTP not configured")
- Verify APP_ORIGIN and SMTP_* env
- Check provider dashboard sending logs
- Ensure firewall/ISP allows outbound connections to SMTP_HOST:SMTP_PORT
