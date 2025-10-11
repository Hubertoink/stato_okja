import { Controller, Get, Post, Patch, Delete, Param, Body, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ArchiveProjectDto } from './dto/archive-project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Projekte abrufen' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'archived', required: false })
  findAll(@Query('search') search?: string, @Query('archived') archived?: string) {
    const archivedBool = archived === 'true' ? true : archived === 'false' ? false : undefined;
    return this.projectsService.findAll(search, archivedBool);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Projekt per ID abrufen' })
  async findOne(@Param('id') id: string) {
    const p = await this.projectsService.findOne(id);
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  @Post()
  @ApiOperation({ summary: 'Projekt anlegen' })
  create(@Body() data: CreateProjectDto) {
    return this.projectsService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Projekt bearbeiten' })
  update(@Param('id') id: string, @Body() data: UpdateProjectDto) {
    return this.projectsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Projekt löschen' })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Projekt archivieren / wiederherstellen' })
  setArchived(@Param('id') id: string, @Body() body: ArchiveProjectDto) {
    return this.projectsService.archive(id, body.archived ?? true);
  }
}
