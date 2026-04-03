import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DevToolsService } from './dev-tools.service';
import { GenerateTestDataDto } from './dto/generate-test-data.dto';

type RequestUser = { id: string; role: string; orgId?: string | null };

@ApiTags('dev-tools')
@Controller('dev-tools')
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
export class DevToolsController {
  constructor(private readonly devToolsService: DevToolsService) {}

  @Post('test-data/generate')
  @Roles('superadmin', 'org_admin')
  @ApiOperation({ summary: 'Erzeugt realistische Testdaten für die aktuell gewählte Organisation' })
  generateTestData(
    @Body() body: GenerateTestDataDto,
    @Req() req: { user: RequestUser; effectiveOrgId?: string | null | undefined },
  ) {
    const orgId =
      req.user.role === 'superadmin'
        ? typeof req.effectiveOrgId === 'string'
          ? req.effectiveOrgId
          : null
        : typeof req.effectiveOrgId === 'string'
          ? req.effectiveOrgId
          : (req.user.orgId ?? null);
    return this.devToolsService.generateForOrg(orgId, body);
  }

  @Delete('test-data/generated')
  @Roles('superadmin', 'org_admin')
  @ApiOperation({ summary: 'Entfernt zuvor erzeugte Testdaten der aktuell gewählten Organisation' })
  removeGenerated(@Req() req: { user: RequestUser; effectiveOrgId?: string | null | undefined }) {
    const orgId =
      req.user.role === 'superadmin'
        ? typeof req.effectiveOrgId === 'string'
          ? req.effectiveOrgId
          : null
        : typeof req.effectiveOrgId === 'string'
          ? req.effectiveOrgId
          : (req.user.orgId ?? null);
    return this.devToolsService.removeGeneratedForOrg(orgId);
  }
}