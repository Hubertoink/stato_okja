Email service

- Uses Nodemailer; transport is created lazily based on env variables.
- Env:
  - SMTP_HOST (required to send)
  - SMTP_PORT (default 587)
  - SMTP_USER/SMTP_PASS (optional; if omitted, unauthenticated SMTP is used, useful for Mailpit in dev)
  - SMTP_FROM (default no-reply@stato.local)
  - APP_ORIGIN controls links in invite/reset

Behavior:

- If SMTP_HOST is missing, service logs the invite/reset links instead of sending.
- In development, run Mailpit and set SMTP_HOST/PORT to test emails.
