import { Controller, Get, Post, Patch, Delete, Param, Body, Query, NotFoundException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { OrgsService } from '../orgs/orgs.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ArchiveProjectDto } from './dto/archive-project.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService, private readonly orgs: OrgsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Projekte abrufen' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'archived', required: false })
  async findAll(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('search') search?: string, @Query('archived') archived?: string) {
    const archivedBool = archived === 'true' ? true : archived === 'false' ? false : undefined;
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin'
      ? superAdminScoped
      : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    let orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
      orgId = undefined;
    }
    return this.projectsService.findAll(search, archivedBool, orgId, orgIds);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Projekt per ID abrufen' })
  async findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const p = await this.projectsService.findOneScoped(id, req.user);
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  @Post()
  @ApiOperation({ summary: 'Projekt anlegen' })
  create(@Body() data: CreateProjectDto, @Req() req: { user: { id: string; role: string; orgId?: string|null; name?: string|null }; effectiveOrgId?: string|null|undefined }) {
    // Enforce orgId from scope only; ignore body
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.projectsService.create({ ...data, orgId }, { id: req.user.id, name: req.user.name || null, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Projekt bearbeiten' })
  update(@Param('id') id: string, @Body() data: UpdateProjectDto, @Req() req: { user: { role: string; orgId?: string|null } }) {
    // Never allow changing orgId via update
    const rest: UpdateProjectDto = { ...(data as UpdateProjectDto) };
    delete (rest as UpdateProjectDto & { orgId?: string | null }).orgId;
    return this.projectsService.updateScoped(id, rest, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Projekt löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.projectsService.removeScoped(id, req.user);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Projekt archivieren / wiederherstellen' })
  setArchived(@Param('id') id: string, @Body() body: ArchiveProjectDto, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.projectsService.archiveScoped(id, body.archived ?? true, req.user);
  }
}
