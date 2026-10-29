import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { ValidationPipe } from '@nestjs/common';
import { UpdateMeDto } from './dto/auth.dto';

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
    const memberships = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
    const service = new AuthService(
      users as never,
      orgs as never,
      memberships as never,
      {} as never,
      refreshSessions as never,
      jwt as never,
      email as never,
      {} as never,
      { getTermsOfUseVersion: jest.fn().mockResolvedValue('test-terms-version') } as never,
    );
    return { service, users, memberships, jwt, email, refreshSessions };
  }

  it('saves and returns the account view density without changing other profile fields', async () => {
    const { service, users } = createService({ existingUser: {
      id: 'user-1', name: 'Existing name', email: 'user@example.org', role: 'user', viewDensity: 'compact',
    } });
    expect(await service.updateProfile('user-1', { viewDensity: 'normal' })).toEqual(
      expect.objectContaining({ id: 'user-1', name: 'Existing name', viewDensity: 'normal' }),
    );
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ viewDensity: 'normal' }));
    expect(await service.getProfile('user-1')).toEqual(expect.objectContaining({ viewDensity: 'normal' }));
    expect(await service.updateProfile('user-1', { viewDensity: 'compact' })).toEqual(
      expect.objectContaining({ viewDensity: 'compact' }),
    );
  });

  it('rejects unsupported view density values at the profile API boundary', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata = { type: 'body' as const, metatype: UpdateMeDto };
    await expect(pipe.transform({ viewDensity: 'tiny' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ viewDensity: 'normal' }, metadata)).resolves.toEqual(expect.objectContaining({ viewDensity: 'normal' }));
  });

  it('saves and returns the account navigation layout without changing other profile fields', async () => {
    const { service, users } = createService({ existingUser: {
      id: 'user-1', name: 'Existing name', email: 'user@example.org', role: 'user', navigationLayout: 'sidebar',
    } });
    expect(await service.updateProfile('user-1', { navigationLayout: 'top' })).toEqual(
      expect.objectContaining({ id: 'user-1', name: 'Existing name', navigationLayout: 'top' }),
    );
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ navigationLayout: 'top' }));
    expect(await service.getProfile('user-1')).toEqual(expect.objectContaining({ navigationLayout: 'top' }));
    expect(await service.updateProfile('user-1', { navigationLayout: 'sidebar' })).toEqual(
      expect.objectContaining({ navigationLayout: 'sidebar' }),
    );
  });

  it('rejects unsupported navigation layout values at the profile API boundary', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const metadata = { type: 'body' as const, metatype: UpdateMeDto };
    await expect(pipe.transform({ navigationLayout: 'tiny' }, metadata)).rejects.toThrow();
    await expect(pipe.transform({ navigationLayout: 'top' }, metadata)).resolves.toEqual(expect.objectContaining({ navigationLayout: 'top' }));
  });

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
      outcome: 'invited',
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

  it('adds an organization membership to an already active account', async () => {
    const { service, memberships } = createService({
      existingUser: {
        id: 'active-user',
        email: 'active@example.org',
        passwordHash: 'hash',
        role: 'user',
        orgId: 'org-1',
      },
    });

    await expect(service.inviteUser({ email: 'active@example.org', name: 'Active User', role: 'org_admin', orgId: 'org-2' }))
      .resolves.toEqual(expect.objectContaining({ invitationSent: true }));
    expect(memberships.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'active-user', orgId: 'org-2', role: 'org_admin', status: 'active',
    }));
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
    ).rejects.toThrow('SMTP');
    expect(users.delete).toHaveBeenCalledWith({ id: 'user-1' });
  });

  it('reports an already active membership without sending mail or changing its role', async () => {
    const { service, memberships, email } = createService({ existingUser: {
      id: 'user-1', email: 'existing@example.org', passwordHash: 'hash', role: 'user', orgId: 'org-1',
    } });
    memberships.findOne.mockResolvedValue({ userId: 'user-1', orgId: 'org-1', role: 'org_admin', status: 'active' });
    const result = await service.inviteUser({ email: 'existing@example.org', name: 'Existing', role: 'user', orgId: 'org-1' });
    expect(result).toMatchObject({ outcome: 'already_member', emailQueued: false, user: { role: 'org_admin' } });
    expect(memberships.save).not.toHaveBeenCalled();
    expect(email.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('reactivates a disabled membership for an existing account without requiring SMTP', async () => {
    const { service, memberships, email } = createService({ existingUser: {
      id: 'user-1', email: 'existing@example.org', passwordHash: 'hash', role: 'user', orgId: 'org-1',
    }, emailResult: { queued: false } });
    memberships.findOne.mockResolvedValue({ userId: 'user-1', orgId: 'org-1', role: 'user', status: 'disabled' });
    await expect(service.inviteUser({ email: 'existing@example.org', name: 'Existing', role: 'user', orgId: 'org-1' }))
      .resolves.toMatchObject({ outcome: 'access_added', emailQueued: false });
    expect(memberships.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    expect(email.sendInviteEmail).not.toHaveBeenCalled();
  });

  it.each([true, false])('only reactivates a pending invitation after successful delivery: %s', async (queued) => {
    const { service, memberships, users } = createService({ existingUser: {
      id: 'user-1', email: 'pending@example.org', passwordHash: null, role: 'user', orgId: 'org-1', inviteTokenVersion: 2,
    }, emailResult: { queued } });
    memberships.findOne.mockResolvedValue({ userId: 'user-1', orgId: 'org-1', role: 'user', status: 'disabled' });
    const result = service.inviteUser({ email: 'pending@example.org', name: 'Pending', role: 'user', orgId: 'org-1' });
    if (queued) {
      await expect(result).resolves.toMatchObject({ outcome: 'resent', emailQueued: true });
      expect(memberships.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    } else {
      await expect(result).rejects.toThrow('SMTP');
      expect(memberships.save).not.toHaveBeenCalled();
      expect(users.save).toHaveBeenLastCalledWith(expect.objectContaining({ inviteTokenVersion: 2 }));
    }
  });

  it('distinguishes actual delivery failures from missing SMTP configuration', async () => {
    const { service, email, users } = createService();
    email.sendInviteEmail.mockRejectedValue(new Error('Recipient rejected'));
    await expect(service.inviteUser({ email: 'new@example.org', name: 'New', role: 'user', orgId: 'org-1' }))
      .rejects.toMatchObject({ response: { code: 'INVITE_DELIVERY_FAILED' }, status: 503 });
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

  it('reports an incorrect current password as a client error', async () => {
    const { service } = createService({
      existingUser: {
        id: 'user-1',
        email: 'local@example.org',
        name: 'Local User',
        role: 'user',
        orgId: 'org-1',
        passwordHash: await bcrypt.hash('CurrentPassword1!', 10),
      },
    });

    await expect(service.changePassword(
      'user-1',
      'IncorrectPassword1!',
      'ReplacementPassword1!',
    )).rejects.toMatchObject({
      status: 400,
      message: 'Aktuelles Passwort ist falsch',
    });
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
