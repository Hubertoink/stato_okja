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
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('taxonomy')
@Controller('taxonomy')
@UseGuards(JwtAuthGuard)
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  // Categories
  @Get('categories')
  @ApiOperation({ summary: 'Alle Kategorien abrufen' })
  findAllCategories(@Req() req: { user: { role: string; orgId?: string|null } }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = req.user.role === 'superadmin' ? null : (req.user.orgId || null);
    return this.taxonomyService.findAllCategories(isActive, orgId);
  }

  @Get('categories/:id')
  findOneCategory(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.findOneCategoryScoped(id, req.user);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Neue Kategorie anlegen' })
  createCategory(@Body() data: Partial<Category>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const bodyOrgId = (data as Partial<Category> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' ? bodyOrgId : (req.user.orgId || null);
    return this.taxonomyService.createCategory({ ...data, orgId });
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() data: Partial<Category>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.updateCategoryScoped(id, data, req.user);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.removeCategoryScoped(id, req.user);
  }

  // Tags
  @Get('tags')
  @ApiOperation({ summary: 'Alle Tags abrufen' })
  findAllTags(@Req() req: { user: { role: string; orgId?: string|null } }, @Query('active') active?: string, @Query('search') search?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = req.user.role === 'superadmin' ? null : (req.user.orgId || null);
    return this.taxonomyService.findAllTags(isActive, search, orgId);
  }

  @Get('tags/:id')
  findOneTag(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.findOneTagScoped(id, req.user);
  }

  @Post('tags')
  @ApiOperation({ summary: 'Neues Tag anlegen' })
  createTag(@Body() data: Partial<Tag>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const bodyOrgId = (data as Partial<Tag> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' ? bodyOrgId : (req.user.orgId || null);
    return this.taxonomyService.createTag({ ...data, orgId });
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() data: Partial<Tag>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.updateTagScoped(id, data, req.user);
  }

  @Delete('tags/:id')
  removeTag(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.removeTagScoped(id, req.user);
  }

  // Cohorts
  @Get('cohorts')
  @ApiOperation({ summary: 'Alle Alterskohorten abrufen' })
  findAllCohorts(@Req() req: { user: { role: string; orgId?: string|null } }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = req.user.role === 'superadmin' ? null : (req.user.orgId || null);
    return this.taxonomyService.findAllCohorts(isActive, orgId);
  }

  @Get('cohorts/:id')
  findOneCohort(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.findOneCohortScoped(id, req.user);
  }

  @Post('cohorts')
  @ApiOperation({ summary: 'Neue Kohorte anlegen' })
  createCohort(@Body() data: Partial<Cohort>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const bodyOrgId = (data as Partial<Cohort> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' ? bodyOrgId : (req.user.orgId || null);
    return this.taxonomyService.createCohort({ ...data, orgId });
  }

  @Patch('cohorts/:id')
  updateCohort(@Param('id') id: string, @Body() data: Partial<Cohort>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.updateCohortScoped(id, data, req.user);
  }

  @Delete('cohorts/:id')
  removeCohort(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.taxonomyService.removeCohortScoped(id, req.user);
  }
}
