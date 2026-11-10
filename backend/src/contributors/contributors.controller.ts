import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { resolveOrgScope, type OrgScopedUser } from '../auth/org-scope-access';
import { ContributorsService } from './contributors.service';
import { ContributionReportQuery, CreateContributorDto, UpdateContributorDto } from './contributors.dto';

type ScopedRequest = { user: OrgScopedUser; effectiveOrgId?: string | null };
const scope = (req: ScopedRequest) => resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });

@Controller('contributors')
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
export class ContributorsController {
  constructor(private readonly contributors: ContributorsService) {}

  @Get()
  list(@Req() req: ScopedRequest) { return this.contributors.list(scope(req)); }

  @Get('report')
  report(@Query() query: ContributionReportQuery, @Req() req: ScopedRequest) {
    return this.contributors.report(query, scope(req));
  }

  @Post()
  @Roles('superadmin', 'org_admin', 'editor')
  create(@Body() data: CreateContributorDto, @Req() req: ScopedRequest) {
    return this.contributors.create(data, scope(req));
  }

  @Get(':id/usage')
  @Roles('superadmin', 'org_admin', 'editor')
  usage(@Param('id', ParseUUIDPipe) id: string, @Req() req: ScopedRequest) {
    return this.contributors.usage(id, scope(req));
  }

  @Delete(':id')
  @Roles('superadmin', 'org_admin', 'editor')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: ScopedRequest) {
    return this.contributors.remove(id, scope(req));
  }

  @Patch(':id')
  @Roles('superadmin', 'org_admin', 'editor')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateContributorDto, @Req() req: ScopedRequest) {
    return this.contributors.update(id, data, scope(req));
  }
}
