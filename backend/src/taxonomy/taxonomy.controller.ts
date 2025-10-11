import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { Cohort } from './entities/cohort.entity';

@ApiTags('taxonomy')
@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  // Categories
  @Get('categories')
  @ApiOperation({ summary: 'Alle Kategorien abrufen' })
  findAllCategories(@Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.taxonomyService.findAllCategories(isActive);
  }

  @Get('categories/:id')
  findOneCategory(@Param('id') id: string) {
    return this.taxonomyService.findOneCategory(id);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Neue Kategorie anlegen' })
  createCategory(@Body() data: Partial<Category>) {
    return this.taxonomyService.createCategory(data);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() data: Partial<Category>) {
    return this.taxonomyService.updateCategory(id, data);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.taxonomyService.removeCategory(id);
  }

  // Tags
  @Get('tags')
  @ApiOperation({ summary: 'Alle Tags abrufen' })
  findAllTags(@Query('active') active?: string, @Query('search') search?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.taxonomyService.findAllTags(isActive, search);
  }

  @Get('tags/:id')
  findOneTag(@Param('id') id: string) {
    return this.taxonomyService.findOneTag(id);
  }

  @Post('tags')
  @ApiOperation({ summary: 'Neues Tag anlegen' })
  createTag(@Body() data: Partial<Tag>) {
    return this.taxonomyService.createTag(data);
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() data: Partial<Tag>) {
    return this.taxonomyService.updateTag(id, data);
  }

  @Delete('tags/:id')
  removeTag(@Param('id') id: string) {
    return this.taxonomyService.removeTag(id);
  }

  // Cohorts
  @Get('cohorts')
  @ApiOperation({ summary: 'Alle Alterskohorten abrufen' })
  findAllCohorts(@Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.taxonomyService.findAllCohorts(isActive);
  }

  @Get('cohorts/:id')
  findOneCohort(@Param('id') id: string) {
    return this.taxonomyService.findOneCohort(id);
  }

  @Post('cohorts')
  @ApiOperation({ summary: 'Neue Kohorte anlegen' })
  createCohort(@Body() data: Partial<Cohort>) {
    return this.taxonomyService.createCohort(data);
  }

  @Patch('cohorts/:id')
  updateCohort(@Param('id') id: string, @Body() data: Partial<Cohort>) {
    return this.taxonomyService.updateCohort(id, data);
  }

  @Delete('cohorts/:id')
  removeCohort(@Param('id') id: string) {
    return this.taxonomyService.removeCohort(id);
  }
}
