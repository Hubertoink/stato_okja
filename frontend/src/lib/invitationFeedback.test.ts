import { describe, expect, it } from 'vitest';
import { invitationFeedback } from './invitationFeedback';
import type { InviteUserResult } from './orgs';

describe('invitation feedback', () => {
  it.each(['access_added', 'already_member'] as const)('does not misreport %s as an SMTP error', (outcome) => {
    const message = invitationFeedback({ outcome, emailQueued: false } as InviteUserResult);
    expect(message).toContain('Benutzerkonto existiert bereits');
    expect(message).not.toContain('SMTP');
  });
  it('explains a resent invitation', () => {
    expect(invitationFeedback({ outcome: 'resent', emailQueued: true } as InviteUserResult)).toContain('ausstehende Einladung');
  });
});
