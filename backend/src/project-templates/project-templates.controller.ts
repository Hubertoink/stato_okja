import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrgsService } from '../orgs/orgs.service';
import { CreateProjectTemplateDto } from './dto/create-project-template.dto';
import { UpdateProjectTemplateDto } from './dto/update-project-template.dto';
import { ProjectTemplatesService } from './project-templates.service';

@ApiTags('project-templates')
@Controller('project-templates')
@UseGuards(JwtAuthGuard, OrgScopeGuard, RolesGuard)
export class ProjectTemplatesController {
  constructor(private readonly svc: ProjectTemplatesService, private readonly orgs: OrgsService) {}

  @Get()
  async listAvailable(@Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined }) {
    // Mirror scoping logic used elsewhere (superadmin without scope -> null)
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? superAdminScoped
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);

    if (typeof orgIdRaw === 'string') {
      const ancestors = await this.orgs.getAncestorOrgIds(orgIdRaw);
      return this.svc.listAvailable(orgIdRaw, ancestors);
    }
    return this.svc.listAvailable(null);
  }

  // List templates owned by current org scope (used for admin management)
  @Roles('superadmin', 'org_admin')
  @Get('owned')
  async listOwned(@Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined }) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.svc.listOwned(orgId);
  }

  @Roles('superadmin', 'org_admin')
  @Post()
  async create(
    @Body() dto: CreateProjectTemplateDto,
    @Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined },
  ) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.svc.createScoped(dto, orgId);
  }

  @Roles('superadmin', 'org_admin')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectTemplateDto,
    @Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined },
  ) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    const updated = await this.svc.updateScoped(id, dto, orgId);
    if (!updated) throw new NotFoundException('Template not found');
    return updated;
  }

  @Roles('superadmin', 'org_admin')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: { user: { role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined },
  ) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    const ok = await this.svc.removeScoped(id, orgId);
    if (!ok) throw new NotFoundException('Template not found');
    return { ok: true };
  }
}
