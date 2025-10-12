import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) {
      this.logger.warn('SMTP not configured; emails will be logged instead of sent.');
      return null;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return this.transporter;
  }

  async sendInviteEmail(to: string, name: string, link: string) {
    const from = process.env.SMTP_FROM || 'no-reply@stato.local';
    const subject = 'Einladung zu Stato 2.0';
    const text = `Hallo ${name || ''},\n\n`+
      `du wurdest zu Stato 2.0 eingeladen. Bitte setze dein Passwort über folgenden Link:\n\n${link}\n\n`+
      `Dieser Link ist zeitlich begrenzt gültig.`;
    const html = `<p>Hallo ${name || ''},</p>`+
      `<p>du wurdest zu <strong>Stato 2.0</strong> eingeladen. Klicke auf den Link, um dein Passwort zu setzen:</p>`+
      `<p><a href="${link}">${link}</a></p>`+
      `<p>Der Link ist zeitlich begrenzt gültig.</p>`;

    const transporter = this.getTransporter();
    if (!transporter) {
      // Fallback: log invite link for manual sending
      this.logger.log(`Invite for ${to}: ${link}`);
      return { queued: false, logged: true };
    }
    await transporter.sendMail({ from, to, subject, text, html });
    return { queued: true };
  }

  async sendPasswordResetEmail(to: string, name: string, link: string) {
    const from = process.env.SMTP_FROM || 'no-reply@stato.local';
    const subject = 'Passwort zurücksetzen – Stato 2.0';
    const text = `Hallo ${name || ''},\n\n`+
      `du hast ein Zurücksetzen deines Passworts angefordert. Bitte setze dein Passwort über folgenden Link:\n\n${link}\n\n`+
      `Dieser Link ist zeitlich begrenzt gültig.`;
    const html = `<p>Hallo ${name || ''},</p>`+
      `<p>du hast ein Zurücksetzen deines Passworts angefordert. Klicke auf den Link, um ein neues Passwort zu setzen:</p>`+
      `<p><a href="${link}">${link}</a></p>`+
      `<p>Der Link ist zeitlich begrenzt gültig.</p>`;

    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.log(`Password reset for ${to}: ${link}`);
      return { queued: false, logged: true };
    }
    await transporter.sendMail({ from, to, subject, text, html });
    return { queued: true };
  }
}
