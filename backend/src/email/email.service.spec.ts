import { EmailService } from './email.service';

describe('invitation transport errors', () => {
  it('reports missing SMTP configuration as a specific service-unavailable error', async () => {
    const previousHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    try {
      await expect(new EmailService().sendInviteEmail('person@example.org', 'Person', 'https://example.org/accept-invite?token=test'))
        .rejects.toMatchObject({ status: 503, response: { code: 'SMTP_NOT_CONFIGURED' } });
    } finally {
      if (previousHost === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = previousHost;
    }
  });
});
