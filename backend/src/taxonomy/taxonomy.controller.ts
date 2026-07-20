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
import { resolveOrgScope } from '../auth/org-scope-access';

function pickDefined<T extends object>(data: Partial<T>, keys: Array<keyof T>): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (typeof data[key] !== 'undefined') {
      result[key] = data[key];
    }
  }
  return result;
}

function sanitizeCategoryPayload(data: Partial<Category>): Partial<Category> {
  return pickDefined(data, ['name', 'description', 'standardRef', 'color', 'active']);
}

function sanitizeTagPayload(data: Partial<Tag>): Partial<Tag> {
  return pickDefined(data, ['name', 'synonyms', 'color', 'active', 'description']);
}

function sanitizeCohortPayload(data: Partial<Cohort>): Partial<Cohort> {
  return pickDefined(data, ['name', 'minAge', 'maxAge', 'sortOrder', 'active', 'inheritToChildren']);
}

type TaxonomyKind = 'categories' | 'tags' | 'cohorts';
type TaxonomyRequest = {
  user: { id?: string; name?: string | null; role: string; orgId?: string | null };
  effectiveOrgId?: string | null | undefined;
};

const TAXONOMY_LOCKED_MESSAGES: Record<TaxonomyKind, string> = {
  categories: 'Für diese Organisation sind lokale Kategorien gesperrt',
  tags: 'Für diese Organisation sind lokale Tags gesperrt',
  cohorts: 'Für diese Organisation sind lokale Kohorten gesperrt',
};

function parseActiveQuery(active?: string) {
  return active === 'true' ? true : active === 'false' ? false : undefined;
}

@ApiTags('taxonomy')
@Controller('taxonomy')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService, private readonly orgs: OrgsService) {}

  private resolveScopedOrgId(req: TaxonomyRequest): string | null {
    return resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  private getScopedUser(req: TaxonomyRequest) {
    return { ...req.user, effectiveOrgId: req.effectiveOrgId };
  }

  private async getCreateContext(kind: TaxonomyKind, req: TaxonomyRequest) {
    const orgId = this.resolveScopedOrgId(req);
    if (!(await this.orgs.canCreateOwnTaxonomy(orgId ?? null, kind))) {
      throw new ForbiddenException(TAXONOMY_LOCKED_MESSAGES[kind]);
    }
    return {
      orgId,
      user: { id: req.user.id, name: req.user.name || null, orgId },
    };
  }

  // Categories
  @Get('categories')
  @ApiOperation({ summary: 'Alle Kategorien abrufen' })
  async findAllCategories(@Req() req: TaxonomyRequest, @Query('active') active?: string) {
    return this.taxonomyService.findAllCategories(parseActiveQuery(active), this.resolveScopedOrgId(req));
  }

  @Get('categories/:id')
  findOneCategory(@Param('id') id: string, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.findOneCategoryScoped(id, this.getScopedUser(req));
  }

  @Get('access')
  @ApiOperation({ summary: 'Erlaubnisse für lokale Taxonomien im aktuellen Scope' })
  async access(@Req() req: TaxonomyRequest) {
    return this.orgs.getTaxonomyAccessForOrg(this.resolveScopedOrgId(req) ?? null);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Neue Kategorie anlegen' })
  async createCategory(@Body() data: Partial<Category>, @Req() req: TaxonomyRequest) {
    const { orgId, user } = await this.getCreateContext('categories', req);
    return this.taxonomyService.createCategory({ ...sanitizeCategoryPayload(data), orgId }, user);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() data: Partial<Category>, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.updateCategoryScoped(id, sanitizeCategoryPayload(data), this.getScopedUser(req));
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.removeCategoryScoped(id, this.getScopedUser(req));
  }

  // Tags
  @Get('tags')
  @ApiOperation({ summary: 'Alle Tags abrufen' })
  async findAllTags(@Req() req: TaxonomyRequest, @Query('active') active?: string, @Query('search') search?: string) {
    return this.taxonomyService.findAllTags(parseActiveQuery(active), search, this.resolveScopedOrgId(req));
  }

  @Get('tags/:id')
  findOneTag(@Param('id') id: string, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.findOneTagScoped(id, this.getScopedUser(req));
  }

  @Post('tags')
  @ApiOperation({ summary: 'Neues Tag anlegen' })
  async createTag(@Body() data: Partial<Tag>, @Req() req: TaxonomyRequest) {
    const { orgId, user } = await this.getCreateContext('tags', req);
    return this.taxonomyService.createTag({ ...sanitizeTagPayload(data), orgId }, user);
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() data: Partial<Tag>, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.updateTagScoped(id, sanitizeTagPayload(data), this.getScopedUser(req));
  }

  @Delete('tags/:id')
  removeTag(@Param('id') id: string, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.removeTagScoped(id, this.getScopedUser(req));
  }

  // Cohorts
  @Get('cohorts')
  @ApiOperation({ summary: 'Alle Alterskohorten abrufen' })
  async findAllCohorts(@Req() req: TaxonomyRequest, @Query('active') active?: string) {
    return this.taxonomyService.findAllCohorts(parseActiveQuery(active), this.resolveScopedOrgId(req));
  }

  @Get('cohorts/:id')
  findOneCohort(@Param('id') id: string, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.findOneCohortScoped(id, this.getScopedUser(req));
  }

  @Post('cohorts')
  @ApiOperation({ summary: 'Neue Kohorte anlegen' })
  async createCohort(@Body() data: Partial<Cohort>, @Req() req: TaxonomyRequest) {
    const { orgId, user } = await this.getCreateContext('cohorts', req);
    return this.taxonomyService.createCohort({ ...sanitizeCohortPayload(data), orgId }, user);
  }

  @Patch('cohorts/:id')
  updateCohort(@Param('id') id: string, @Body() data: Partial<Cohort>, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.updateCohortScoped(id, sanitizeCohortPayload(data), this.getScopedUser(req));
  }

  @Delete('cohorts/:id')
  removeCohort(@Param('id') id: string, @Req() req: TaxonomyRequest) {
    return this.taxonomyService.removeCohortScoped(id, this.getScopedUser(req));
  }
}
