import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('invite-token'),
      verifyAsync: jest.fn(),
    };
    const email = { sendInviteEmail: jest.fn().mockResolvedValue(options.emailResult ?? { queued: true }) };
    const orgs = { findOne: jest.fn().mockResolvedValue(null) };
    const refreshSessions = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: 'session-1', ...data })),
      save: jest.fn(async (session) => session),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AuthService(
      users as never,
      orgs as never,
      {} as never,
      refreshSessions as never,
      jwt as never,
      email as never,
      {} as never,
      { getTermsOfUseVersion: jest.fn().mockResolvedValue('test-terms-version') } as never,
    );
    return { service, users, jwt, email, refreshSessions };
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

  it('creates a local account only when local provisioning is enabled', async () => {
    const previousMode = process.env.USER_PROVISIONING_MODE;
    process.env.USER_PROVISIONING_MODE = 'local';
    try {
      const { service, users } = createService();
      const result = await service.createLocalUser({
        email: 'Local.Admin@example.org',
        name: 'Local Admin',
        role: 'org_admin',
        orgId: 'org-1',
        temporaryPassword: 'StrongLocal1!',
      });

      expect(result).toEqual(expect.objectContaining({
        email: 'local.admin@example.org',
        orgId: 'org-1',
        mustChangePassword: true,
      }));
      expect(users.create).toHaveBeenCalledWith(expect.objectContaining({
        passwordHash: null,
        mustChangePassword: false,
      }));
      expect(users.save).toHaveBeenCalledWith(expect.objectContaining({
        passwordHash: expect.any(String),
        mustChangePassword: true,
      }));
    } finally {
      if (typeof previousMode === 'undefined') delete process.env.USER_PROVISIONING_MODE;
      else process.env.USER_PROVISIONING_MODE = previousMode;
    }
  });

  it('rejects local account creation while email provisioning is active', async () => {
    const previousMode = process.env.USER_PROVISIONING_MODE;
    process.env.USER_PROVISIONING_MODE = 'email';
    try {
      const { service } = createService();
      await expect(service.createLocalUser({
        email: 'local@example.org',
        name: 'Local User',
        orgId: 'org-1',
        temporaryPassword: 'StrongLocal1!',
      })).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      if (typeof previousMode === 'undefined') delete process.env.USER_PROVISIONING_MODE;
      else process.env.USER_PROVISIONING_MODE = previousMode;
    }
  });

  it('replaces the current session after a password change', async () => {
    const { service, refreshSessions } = createService({
      existingUser: {
        id: 'user-1',
        email: 'local@example.org',
        name: 'Local User',
        role: 'user',
        orgId: 'org-1',
        passwordHash: await bcrypt.hash('CurrentPassword1!', 10),
        mustChangePassword: true,
      },
    });

    const session = await service.changePassword(
      'user-1',
      'CurrentPassword1!',
      'ReplacementPassword1!',
      { ipAddress: '127.0.0.1' },
    );

    expect(refreshSessions.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(refreshSessions.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(session).toEqual(expect.objectContaining({
      access_token: 'invite-token',
      refreshToken: expect.any(String),
      refresh_csrf_token: expect.any(String),
      user: expect.objectContaining({ mustChangePassword: false }),
    }));
  });

  it('accepts an active reset token without consuming it', async () => {
    const { service, jwt } = createService({
      existingUser: { id: 'user-1', passwordResetTokenVersion: 3 },
    });
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'reset', version: 3 });

    await expect(service.validateResetToken('reset-token')).resolves.toEqual({ ok: true });
  });

  it('rejects expired and replaced reset tokens during validation', async () => {
    const expired = createService();
    expired.jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(expired.service.validateResetToken('expired-token')).rejects.toBeInstanceOf(UnauthorizedException);

    const replaced = createService({
      existingUser: { id: 'user-1', passwordResetTokenVersion: 4 },
    });
    replaced.jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', purpose: 'reset', version: 3 });
    await expect(replaced.service.validateResetToken('replaced-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
