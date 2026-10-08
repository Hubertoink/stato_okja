import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { resolveOrgScope } from '../auth/org-scope-access';
import { AnnualTargetsService } from './annual-targets.service';
import { AnnualTargetsGuard } from './annual-targets.guard';
import {
  AnnualTargetCommandDto,
  AnnualTargetCopyDto,
  AnnualTargetDto,
} from './dto/annual-target.dto';

type TargetRequest = {
  user: { id: string; name?: string; role: string; orgId?: string | null };
  effectiveOrgId?: string | null;
};
@ApiTags('annual-targets')
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard, AnnualTargetsGuard)
@Controller('stats/annual-targets')
export class AnnualTargetsController {
  constructor(private readonly targets: AnnualTargetsService) {}
  private org(req: TargetRequest) {
    return resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Get()
  list(@Req() req: TargetRequest, @Query('year', ParseIntPipe) year: number) {
    if (year < 2000 || year > 2200) throw new BadRequestException('Ungültiges Zieljahr');
    return this.targets.list(this.org(req), year);
  }
  @Get(':id')
  detail(@Req() req: TargetRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.targets.detail(this.org(req), id);
  }
  @Get(':id/activities')
  activities(
    @Req() req: TargetRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', ParseIntPipe) page: number,
  ) {
    if (page < 1 || page > 100000) throw new BadRequestException('Ungültige Seite');
    return this.targets.activityList(this.org(req), id, page);
  }
  @Post()
  @Roles('superadmin', 'org_admin')
  create(@Req() req: TargetRequest, @Body() dto: AnnualTargetDto) {
    return this.targets.create(this.org(req), req.user.id, dto, req.user.name);
  }
  @Patch(':id')
  @Roles('superadmin', 'org_admin')
  update(
    @Req() req: TargetRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnualTargetDto,
  ) {
    return this.targets.update(this.org(req), req.user.id, id, dto, req.user.name);
  }
  @Post(':id/command')
  @Roles('superadmin', 'org_admin')
  command(
    @Req() req: TargetRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnualTargetCommandDto,
  ) {
    return this.targets.command(this.org(req), req.user.id, id, dto, req.user.name);
  }
  @Post(':id/copy')
  @Roles('superadmin', 'org_admin')
  copy(
    @Req() req: TargetRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnnualTargetCopyDto,
  ) {
    return this.targets.copy(this.org(req), req.user.id, id, dto.year, req.user.name);
  }
}
