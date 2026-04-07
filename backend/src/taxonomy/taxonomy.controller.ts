import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { OrgsService } from '../orgs/orgs.service';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@ApiTags('taxonomy')
@Controller('taxonomy')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService, private readonly orgs: OrgsService) {}

  // Categories
  @Get('categories')
  @ApiOperation({ summary: 'Alle Kategorien abrufen' })
  async findAllCategories(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin' ? superAdminScoped : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.taxonomyService.findAllCategories(isActive, orgIdRaw);
  }

  @Get('categories/:id')
  findOneCategory(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    return this.taxonomyService.findOneCategoryScoped(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Get('access')
  @ApiOperation({ summary: 'Erlaubnisse für lokale Taxonomien im aktuellen Scope' })
  async access(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgId = req.user.role === 'superadmin' ? superAdminScoped : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.orgs.getTaxonomyAccessForOrg(orgId ?? null);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Neue Kategorie anlegen' })
  async createCategory(@Body() data: Partial<Category>, @Req() req: { user: { id: string; name?: string|null; role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    if (!(await this.orgs.canCreateOwnTaxonomy(orgId ?? null, 'categories'))) {
      throw new ForbiddenException('Für diese Organisation sind lokale Kategorien gesperrt');
    }
    return this.taxonomyService.createCategory({ ...data, orgId }, { id: req.user.id, name: req.user.name || null, orgId });
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() data: Partial<Category>, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const rest: Partial<Category> = { ...(data as Partial<Category>) };
    delete (rest as Partial<Category> & { orgId?: string | null }).orgId;
    return this.taxonomyService.updateCategoryScoped(id, rest, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    return this.taxonomyService.removeCategoryScoped(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  // Tags
  @Get('tags')
  @ApiOperation({ summary: 'Alle Tags abrufen' })
  async findAllTags(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string, @Query('search') search?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin' ? superAdminScoped : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.taxonomyService.findAllTags(isActive, search, orgIdRaw);
  }

  @Get('tags/:id')
  findOneTag(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    return this.taxonomyService.findOneTagScoped(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Post('tags')
  @ApiOperation({ summary: 'Neues Tag anlegen' })
  async createTag(@Body() data: Partial<Tag>, @Req() req: { user: { id: string; name?: string|null; role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    if (!(await this.orgs.canCreateOwnTaxonomy(orgId ?? null, 'tags'))) {
      throw new ForbiddenException('Für diese Organisation sind lokale Tags gesperrt');
    }
    return this.taxonomyService.createTag({ ...data, orgId }, { id: req.user.id, name: req.user.name || null, orgId });
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() data: Partial<Tag>, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const rest: Partial<Tag> = { ...(data as Partial<Tag>) };
    delete (rest as Partial<Tag> & { orgId?: string | null }).orgId;
    return this.taxonomyService.updateTagScoped(id, rest, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Delete('tags/:id')
  removeTag(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    return this.taxonomyService.removeTagScoped(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  // Cohorts
  @Get('cohorts')
  @ApiOperation({ summary: 'Alle Alterskohorten abrufen' })
  async findAllCohorts(@Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const superAdminScoped = (typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId;
    const orgIdRaw = req.user.role === 'superadmin' ? superAdminScoped : (typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId);
    return this.taxonomyService.findAllCohorts(isActive, orgIdRaw);
  }

  @Get('cohorts/:id')
  findOneCohort(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    return this.taxonomyService.findOneCohortScoped(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Post('cohorts')
  @ApiOperation({ summary: 'Neue Kohorte anlegen' })
  async createCohort(@Body() data: Partial<Cohort>, @Req() req: { user: { id: string; name?: string|null; role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const orgId = req.user.role === 'superadmin'
      ? ((typeof req.effectiveOrgId === 'undefined') ? null : req.effectiveOrgId)
      : ((typeof req.effectiveOrgId === 'undefined') ? (req.user.orgId || null) : req.effectiveOrgId);
    if (!(await this.orgs.canCreateOwnTaxonomy(orgId ?? null, 'cohorts'))) {
      throw new ForbiddenException('Für diese Organisation sind lokale Kohorten gesperrt');
    }
    return this.taxonomyService.createCohort({ ...data, orgId }, { id: req.user.id, name: req.user.name || null, orgId });
  }

  @Patch('cohorts/:id')
  updateCohort(@Param('id') id: string, @Body() data: Partial<Cohort>, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    const rest: Partial<Cohort> = { ...(data as Partial<Cohort>) };
    delete (rest as Partial<Cohort> & { orgId?: string | null }).orgId;
    return this.taxonomyService.updateCohortScoped(id, rest, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Delete('cohorts/:id')
  removeCohort(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null }; effectiveOrgId?: string|null|undefined }) {
    return this.taxonomyService.removeCohortScoped(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }
}
