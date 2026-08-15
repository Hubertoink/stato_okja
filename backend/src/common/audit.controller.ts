import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditAction } from './enums';

type AuditListRequest = {
  user: { role: string; orgId?: string | null; id: string };
  effectiveOrgId?: string | null | undefined;
};

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  private resolveAuditFilter(req: AuditListRequest) {
    return { orgId: req.effectiveOrgId ?? null, orgIds: undefined };
  }

  private parseActions(actions?: string) {
    if (!actions) return undefined;

    const allowed = new Set<string>(Object.values(AuditAction));
    const parsed = actions
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is AuditAction => allowed.has(value));

    return parsed.length > 0 ? Array.from(new Set(parsed)) : undefined;
  }

  @Get()
  @ApiOperation({ summary: 'Letzte Aktionen (Audit-Logs) auflisten' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'actions', required: false, description: 'CSV-Liste der Audit-Aktionen, z. B. login,create,update,delete' })
  @Roles('superadmin', 'org_admin', 'editor', 'user')
  async list(
    @Req() req: AuditListRequest,
    @Query('limit') limit?: string,
    @Query('actions') actions?: string,
  ) {
    const l = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100) : 50;
    const { orgId, orgIds } = this.resolveAuditFilter(req);
    return this.audit.list({ orgId, orgIds, limit: l, actions: this.parseActions(actions) });
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Audit-Metriken (Superadmin Dashboard)' })
  @ApiQuery({ name: 'orgLimit', required: false, description: 'Max. Orgs in der Liste (Default 200, max 500)' })
  @Roles('superadmin')
  metrics(@Query('orgLimit') orgLimit?: string) {
    const n = typeof orgLimit === 'string' ? parseInt(orgLimit, 10) : undefined;
    return this.audit.metrics({ orgLimit: typeof n === 'number' && !Number.isNaN(n) ? n : undefined });
  }
}
