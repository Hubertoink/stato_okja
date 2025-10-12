import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Letzte Aktionen (Audit-Logs) auflisten' })
  @ApiQuery({ name: 'limit', required: false })
  list(@Req() req: { user: { role: string; orgId?: string | null; id: string } }, @Query('limit') limit?: string) {
    const l = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100) : 50;
    // Superadmin: keine Org-Einschränkung (alle Logs). Andere: orgId aus Token.
    const orgId = req.user.role === 'superadmin' ? undefined : (req.user.orgId || null);
    return this.audit.list({ orgId, limit: l });
  }
}
