import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { isStrictSecurityMode } from '../config/security.config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private smtpVerificationPromise: Promise<void> | null = null;

  // StatO Brand Colors
  private readonly brandColors = {
    viridian: '#40916c',
    cambridgeBlue: '#74c69d',
    teaGreen: '#b7e4c7',
    mintCream: '#d8f3dc',
    azureWeb: '#e9f5ef',
    darkText: '#1a1a1a',
    grayText: '#666666',
  };

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host) {
      this.logger.warn('SMTP not configured (missing SMTP_HOST); emails will be logged instead of sent.');
      return null;
    }
    // Allow unauthenticated SMTP in development (e.g., Mailpit) when no user/pass provided
    const options: nodemailer.TransportOptions & { auth?: { user: string; pass: string } } = {
      host,
      port,
      secure: port === 465,
    };
    if (user && pass) {
      options.auth = { user, pass };
    }
    this.transporter = nodemailer.createTransport(options);
    return this.transporter;
  }

  private getTransportSummary() {
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
    const user = String(process.env.SMTP_USER || '').trim();
    return {
      host: host || '(not configured)',
      port,
      user: user || '(unauthenticated)',
    };
  }

  private handleMissingTransportForLink(kind: 'Invite' | 'Password reset', recipient: string, link: string) {
    if (isStrictSecurityMode()) {
      throw new Error(`${kind} email cannot be sent because SMTP is not configured.`);
    }

    // Links contain bearer credentials and must not be written to application logs.
    void link;
    this.logger.warn(`${kind} email for ${recipient} was not sent because SMTP is not configured.`);
    return { queued: false, logged: true };
  }

  async verifySmtpConnection(options?: { failOnError?: boolean }) {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    if (!this.smtpVerificationPromise) {
      const summary = this.getTransportSummary();
      this.smtpVerificationPromise = transporter
        .verify()
        .then(() => {
          this.logger.log(
            `SMTP connection verified successfully (host=${summary.host}, port=${summary.port}, user=${summary.user})`,
          );
        })
        .catch((error) => {
          this.smtpVerificationPromise = null;
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `SMTP verification failed (host=${summary.host}, port=${summary.port}, user=${summary.user}): ${message}`,
          );
          throw error;
        });
    }

    try {
      await this.smtpVerificationPromise;
      return true;
    } catch (error) {
      if (options?.failOnError) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`SMTP verification failed: ${message}`);
      }
      return false;
    }
  }

  private getEmailTemplate(content: {
    greeting: string;
    mainText: string;
    buttonText: string;
    buttonLink: string;
    footerText: string;
  }): string {
    const { viridian, cambridgeBlue, mintCream, darkText, grayText } = this.brandColors;
    const year = new Date().getFullYear();
    
    return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StatO</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${viridian} 0%, ${cambridgeBlue} 100%); padding: 32px 40px; border-radius: 12px 12px 0 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      Stat<span style="color: ${mintCream};">O</span>
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">
                      OKJA Statistik & Dokumentation
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: ${darkText};">
                ${content.greeting}
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: ${grayText};">
                ${content.mainText}
              </p>
              
              <!-- Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                <tr>
                  <td style="border-radius: 8px; background-color: ${viridian};">
                    <a href="${content.buttonLink}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      ${content.buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; font-size: 14px; color: ${grayText};">
                ${content.footerText}
              </p>
              
              <!-- Link fallback -->
              <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: ${grayText};">
                  Falls der Button nicht funktioniert, kopiere diesen Link:
                </p>
                <p style="margin: 0; font-size: 12px; word-break: break-all;">
                  <a href="${content.buttonLink}" style="color: ${viridian};">${content.buttonLink}</a>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #eee;">
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                © ${year} StatO · OKJA Statistik & Dokumentation<br>
                Diese E-Mail wurde automatisch versendet.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildTwoFactorLoginLink(code: string) {
    const origin = String(process.env.APP_ORIGIN || 'http://localhost:5173').trim() || 'http://localhost:5173';
    const url = new URL(origin);
    url.searchParams.set('twoFactorCode', code);
    return url.toString();
  }

  async sendInviteEmail(to: string, name: string, link: string) {
    const from = process.env.SMTP_FROM || 'no-reply@stato.local';
    const displayName = name || 'dort';
    const subject = '🎉 Einladung zu StatO – Dein Zugang wartet';
    
    const text = `Hallo ${displayName},\n\n` +
      `du wurdest zu StatO eingeladen – der Plattform für OKJA Statistik & Dokumentation.\n\n` +
      `Klicke auf den folgenden Link, um dein Passwort zu setzen und loszulegen:\n\n${link}\n\n` +
      `Dieser Link ist aus Sicherheitsgründen nur 24 Stunden gültig.\n\n` +
      `Bei Fragen wende dich an deinen Administrator.\n\n` +
      `Viele Grüße,\nDein StatO-Team`;
    
    const html = this.getEmailTemplate({
      greeting: `Willkommen bei StatO, ${displayName}!`,
      mainText: 'Du wurdest zu StatO eingeladen – der Plattform für OKJA Statistik & Dokumentation. Klicke auf den Button unten, um dein Passwort zu setzen und direkt loszulegen.',
      buttonText: 'Passwort setzen & loslegen',
      buttonLink: link,
      footerText: 'Dieser Link ist aus Sicherheitsgründen nur 24 Stunden gültig. Bei Fragen wende dich an deinen Administrator.',
    });

    const transporter = this.getTransporter();
    if (!transporter) {
      return this.handleMissingTransportForLink('Invite', to, link);
    }
    try {
      await transporter.sendMail({ from, to, subject, text, html });
      this.logger.log(`Invite email sent successfully to ${to}`);
      return { queued: true };
    } catch (error) {
      this.logger.error(`Failed to send invite email to ${to}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, name: string, link: string) {
    const from = process.env.SMTP_FROM || 'no-reply@stato.local';
    const displayName = name || 'dort';
    const subject = '🔐 Passwort zurücksetzen – StatO';
    
    const text = `Hallo ${displayName},\n\n` +
      `du hast angefordert, dein Passwort für StatO zurückzusetzen.\n\n` +
      `Klicke auf den folgenden Link, um ein neues Passwort zu setzen:\n\n${link}\n\n` +
      `Dieser Link ist aus Sicherheitsgründen nur 1 Stunde gültig.\n\n` +
      `Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.\n\n` +
      `Viele Grüße,\nDein StatO-Team`;
    
    const html = this.getEmailTemplate({
      greeting: `Hallo ${displayName}`,
      mainText: 'Du hast angefordert, dein Passwort für StatO zurückzusetzen. Klicke auf den Button unten, um ein neues Passwort zu vergeben.',
      buttonText: 'Neues Passwort setzen',
      buttonLink: link,
      footerText: 'Dieser Link ist aus Sicherheitsgründen nur 1 Stunde gültig. Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail einfach ignorieren – dein Passwort bleibt unverändert.',
    });

    const transporter = this.getTransporter();
    if (!transporter) {
      return this.handleMissingTransportForLink('Password reset', to, link);
    }
    try {
      await transporter.sendMail({ from, to, subject, text, html });
      this.logger.log(`Password reset email sent successfully to ${to}`);
      return { queued: true };
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async sendTwoFactorCodeEmail(to: string, name: string, code: string, expiresInMinutes: number) {
    const from = process.env.SMTP_FROM || 'no-reply@stato.local';
    const displayName = name || 'dort';
    const subject = '🔐 Dein StatO Sicherheitscode';
    const loginLink = this.buildTwoFactorLoginLink(code);
    const text = `Hallo ${displayName},\n\n` +
      `für deine Anmeldung bei StatO wurde ein Sicherheitscode angefordert.\n\n` +
      `Dein Code lautet: ${code}\n\n` +
      `Wenn StatO im gleichen Browser bereits geöffnet ist, kannst du den Code direkt über diesen Link übernehmen:\n${loginLink}\n\n` +
      `Der Code ist ${expiresInMinutes} Minute(n) gültig. Falls du dich nicht anmelden wolltest, ignoriere diese E-Mail.\n\n` +
      `Viele Grüße,\nDein StatO-Team`;

    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StatO Sicherheitscode</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg, #40916c 0%, #74c69d 100%);padding:32px 40px;border-radius:12px 12px 0 0;">
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Stat<span style="color:#d8f3dc;">O</span></h1>
              <p style="margin:4px 0 0 0;font-size:13px;color:rgba(255,255,255,0.85);">OKJA Statistik & Dokumentation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px 0;font-size:22px;font-weight:600;color:#1a1a1a;">Hallo ${displayName}</h2>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#666666;">für deine Anmeldung bei StatO wurde ein Sicherheitscode angefordert.</p>
              <div style="margin:32px 0;padding:20px;border-radius:12px;background:#f8f9fa;border:1px solid #e5e7eb;text-align:center;">
                <p style="margin:0 0 8px 0;font-size:13px;color:#666666;letter-spacing:0.08em;text-transform:uppercase;">Sicherheitscode</p>
                <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.2em;color:#40916c;">${code}</p>
              </div>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#40916c;">
                    <a href="${loginLink}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      &#128203; Code in StatO uebernehmen
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;color:#666666;">Wenn StatO im gleichen Browser bereits geöffnet ist, wird der Code beim Oeffnen des Links automatisch in die Anmeldemaske übernommen.</p>
              <div style="margin:0 0 24px 0;padding:16px;border-radius:8px;background:#f8f9fa;">
                <p style="margin:0 0 8px 0;font-size:12px;color:#666666;">Falls der Button nicht funktioniert, kopiere diesen Link:</p>
                <p style="margin:0;font-size:12px;word-break:break-all;"><a href="${loginLink}" style="color:#40916c;">${loginLink}</a></p>
              </div>
              <p style="margin:24px 0 0 0;font-size:14px;color:#666666;">Der Code ist ${expiresInMinutes} Minute(n) gültig. Falls du dich nicht anmelden wolltest, ignoriere diese E-Mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const transporter = this.getTransporter();
    if (!transporter) {
      throw new Error('SMTP not configured');
    }

    try {
      await transporter.sendMail({ from, to, subject, text, html });
      this.logger.log(`Two-factor email sent successfully to ${to}`);
      return { queued: true };
    } catch (error) {
      this.logger.error(`Failed to send two-factor email to ${to}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
