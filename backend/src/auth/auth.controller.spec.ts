import { AuthController } from './auth.controller';

describe('AuthController local user creation', () => {
  it('uses the chosen organisation for a superadmin in the global area', async () => {
    const auth = { createLocalUser: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    const controller = new AuthController(auth as never, {} as never, {} as never);

    await controller.createLocalUser(
      {
        email: 'new@example.org',
        name: 'New User',
        role: 'user',
        orgId: 'org-2',
        temporaryPassword: 'StrongPassword1!',
      },
      { user: { id: 'admin-1', role: 'superadmin', orgId: null }, effectiveOrgId: null },
    );

    expect(auth.createLocalUser).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-2',
      role: 'user',
    }));
  });

  it('keeps the active organisation authoritative for an organisation admin', async () => {
    const auth = { createLocalUser: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    const controller = new AuthController(auth as never, {} as never, {} as never);

    await controller.createLocalUser(
      {
        email: 'new@example.org',
        name: 'New User',
        role: 'user',
        orgId: 'foreign-org',
        temporaryPassword: 'StrongPassword1!',
      },
      { user: { id: 'admin-1', role: 'org_admin', orgId: 'org-1' }, effectiveOrgId: 'org-1' },
    );

    expect(auth.createLocalUser).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1' }));
  });
});
