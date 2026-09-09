import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgsService } from './orgs.service';

export const OrganizationModule = (module: 'logbook' | 'surveys' | null) => SetMetadata('organization-module', module);

@Injectable()
export class OrganizationModuleGuard implements CanActivate {
  constructor(private readonly orgs: OrgsService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<'logbook' | 'surveys'>('organization-module', [context.getHandler(), context.getClass()]);
    if (!module) return true;
    const request = context.switchToHttp().getRequest<{ effectiveOrgId?: string | null }>();
    const access = await this.orgs.moduleAccess(request.effectiveOrgId ?? null);
    if (!access[module]) throw new ForbiddenException('Dieses Modul ist für diese Organisation deaktiviert.');
    return true;
  }
}
