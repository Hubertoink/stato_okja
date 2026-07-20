import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService invitations', () => {
  function createService(options: {
    existingUser?: Record<string, unknown> | null;
    emailResult?: { queued: boolean };
  } = {}) {
    const users = {
      findOne: jest.fn().mockResolvedValue(options.existingUser ?? null),
      create: jest.fn((data) => ({ id: 'user-1', ...data })),
      save: jest.fn(async (user) => user),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('invite-token') };
    const email = { sendInviteEmail: jest.fn().mockResolvedValue(options.emailResult ?? { queued: true }) };
    const service = new AuthService(
      users as never,
      { findOne: jest.fn() } as never,
      {} as never,
      {} as never,
      jwt as never,
      email as never,
      {} as never,
    );
    return { service, users, jwt, email };
  }

  it('does not return an invite token and binds it to the pending invite version', async () => {
    const { service, jwt, email } = createService();

    const result = await service.inviteUser({
      email: 'New.User@example.org',
      name: 'New User',
      role: 'user',
      orgId: 'org-1',
    });

    expect(result).toEqual({
      invitationSent: true,
      emailQueued: true,
      user: expect.objectContaining({ email: 'new.user@example.org', orgId: 'org-1' }),
    });
    expect(result).not.toHaveProperty('token');
    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'user-1', purpose: 'invite', version: 1 },
      { expiresIn: 86400 },
    );
    expect(email.sendInviteEmail).toHaveBeenCalledWith(
      'new.user@example.org',
      'New User',
      expect.stringContaining('/accept-invite?token=invite-token'),
    );
  });

  it('rejects inviting an already active account', async () => {
    const { service } = createService({
      existingUser: {
        id: 'active-user',
        email: 'active@example.org',
        passwordHash: 'hash',
        role: 'user',
        orgId: 'org-1',
      },
    });

    await expect(
      service.inviteUser({ email: 'active@example.org', name: 'Active User', role: 'org_admin', orgId: 'org-2' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not change role or organization when resending a pending invite', async () => {
    const { service, users } = createService({
      existingUser: {
        id: 'pending-user',
        email: 'pending@example.org',
        passwordHash: null,
        role: 'user',
        orgId: 'org-1',
        inviteTokenVersion: 2,
      },
    });

    await expect(
      service.inviteUser({ email: 'pending@example.org', name: 'Pending User', role: 'org_admin', orgId: 'org-2' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('removes a newly created pending account when email delivery is unavailable', async () => {
    const { service, users } = createService({ emailResult: { queued: false } });

    await expect(
      service.inviteUser({ email: 'new@example.org', name: 'New User', role: 'user', orgId: 'org-1' }),
    ).rejects.toThrow('Invite email was not delivered');
    expect(users.delete).toHaveBeenCalledWith({ id: 'user-1' });
  });
});
