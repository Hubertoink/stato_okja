import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationModuleGuard } from './organization-module.guard';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { LogbookController } from '../logbook/logbook.controller';
import { SurveysController } from '../surveys/surveys.controller';
import { RolesGuard } from '../auth/roles.guard';

const context = (controller: object, handler: object, request: object) => ({
  getClass: () => controller,
  getHandler: () => handler,
  switchToHttp: () => ({ getRequest: () => request }),
}) as unknown as ExecutionContext;

describe('Organization module access', () => {
  const moduleAccess = jest.fn();
  const reflector = new Reflector();
  const guard = new OrganizationModuleGuard({ moduleAccess } as unknown as OrgsService, reflector);

  beforeEach(() => jest.resetAllMocks());

  it.each(['org_admin', 'editor', 'user'])('denies module configuration to %s', (role) => {
    const roles = new RolesGuard(reflector);
    expect(roles.canActivate(context(OrgsController, OrgsController.prototype.updateModule, { user: { role } }))).toBe(false);
  });

  it('allows only the superadmin to configure modules', () => {
    expect(new RolesGuard(reflector).canActivate(context(OrgsController, OrgsController.prototype.updateModule, { user: { role: 'superadmin' } }))).toBe(true);
  });

  it.each([
    [LogbookController, LogbookController.prototype.list],
    [LogbookController, LogbookController.prototype.create],
    [LogbookController, LogbookController.prototype.update],
    [LogbookController, LogbookController.prototype.createComment],
    [SurveysController, SurveysController.prototype.findAll],
    [SurveysController, SurveysController.prototype.create],
    [SurveysController, SurveysController.prototype.start],
  ])('blocks disabled module endpoints, also for superadmins', async (controller, handler) => {
    moduleAccess.mockResolvedValue({ logbook: false, surveys: false });
    await expect(guard.canActivate(context(controller, handler, { effectiveOrgId: 'child', user: { role: 'superadmin', orgId: 'parent' } }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(moduleAccess).toHaveBeenCalledWith('child');
  });

  it('allows access again when enabled', async () => {
    moduleAccess.mockResolvedValue({ logbook: true });
    await expect(guard.canActivate(context(LogbookController, LogbookController.prototype.list, { effectiveOrgId: 'org' }))).resolves.toBe(true);
  });

  it('keeps historical exports accessible without enabling the module', async () => {
    await expect(guard.canActivate(context(LogbookController, LogbookController.prototype.export, { effectiveOrgId: 'org' }))).resolves.toBe(true);
    expect(moduleAccess).not.toHaveBeenCalled();
  });
});
