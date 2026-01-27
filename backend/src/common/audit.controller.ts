import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Letzte Aktionen (Audit-Logs) auflisten' })
  @ApiQuery({ name: 'limit', required: false })
  @Roles('superadmin')
  list(@Req() req: { user: { role: string; orgId?: string | null; id: string } }, @Query('limit') limit?: string) {
    const l = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100) : 50;
    // Superadmin only (UI & API). If later desired, we can add scoped view.
    return this.audit.list({ orgId: undefined, limit: l });
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
