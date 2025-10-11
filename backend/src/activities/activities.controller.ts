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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { Activity } from './entities/activity.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('activities')
@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Aktivitäten abrufen (mit Filtern)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'types', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'locationIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'projectIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'categoryIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'tagIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'cohortIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'hasNotes', required: false })
  @ApiQuery({ name: 'participantsMin', required: false })
  @ApiQuery({ name: 'participantsMax', required: false })
  @ApiQuery({ name: 'durationMin', required: false })
  @ApiQuery({ name: 'durationMax', required: false })
  @ApiQuery({ name: 'page', required: false, description: '1-basierte Seite für Paginierung' })
  @ApiQuery({ name: 'limit', required: false, description: 'Anzahl je Seite (max 50, Standard 50)' })
  findAll(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('types') typesCsv?: string,
    @Query('locationId') locationId?: string,
    @Query('locationIds') locationIdsCsv?: string,
    @Query('projectIds') projectIdsCsv?: string,
    @Query('categoryIds') categoryIdsCsv?: string,
    @Query('tagIds') tagIdsCsv?: string,
    @Query('cohortIds') cohortIdsCsv?: string,
    @Query('hasNotes') hasNotes?: string,
    @Query('participantsMin') participantsMin?: string,
    @Query('participantsMax') participantsMax?: string,
    @Query('durationMin') durationMin?: string,
    @Query('durationMax') durationMax?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const orgId = req.user.role === 'superadmin'
      ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null))
      : (req.user.orgId || null);
    const csvToArray = (s?: string) => (s ? s.split(',').map((v)=>v.trim()).filter(Boolean) : undefined);
    const page = pageStr ? Math.max(parseInt(pageStr, 10) || 1, 1) : undefined;
    const limitParsed = limitStr ? (parseInt(limitStr, 10) || 50) : 50;
    const limit = Math.min(Math.max(limitParsed, 1), 50);

    const filters = {
      from,
      to,
      type,
      types: csvToArray(typesCsv),
      locationId,
      locationIds: csvToArray(locationIdsCsv),
      projectIds: csvToArray(projectIdsCsv),
      categoryIds: csvToArray(categoryIdsCsv),
      tagIds: csvToArray(tagIdsCsv),
      cohortIds: csvToArray(cohortIdsCsv),
      hasNotes: typeof hasNotes !== 'undefined' ? (hasNotes === 'true' || hasNotes === '1') : undefined,
      participantsMin: participantsMin ? parseInt(participantsMin, 10) : undefined,
      participantsMax: participantsMax ? parseInt(participantsMax, 10) : undefined,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
      durationMax: durationMax ? parseInt(durationMax, 10) : undefined,
      orgId,
    } as const;

    // Wenn page gesetzt ist, paginierte Antwort liefern, sonst alle (bestehendes Verhalten)
    if (typeof page !== 'undefined') {
      return this.activitiesService.findAllPaged({ ...filters, page, limit });
    }
    return this.activitiesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Aktivität nach ID abrufen' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.activitiesService.findOneScoped(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Aktivität anlegen' })
  create(@Body() data: Partial<Activity>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    // Enforce orgId
    const bodyOrgId = (data as Partial<Activity> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' ? bodyOrgId : (req.user.orgId || null);
    return this.activitiesService.create({ ...data, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aktivität bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Activity>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const bodyOrgId = (data as Partial<Activity> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' ? bodyOrgId : (req.user.orgId || null);
    return this.activitiesService.updateScoped(id, { ...data, orgId }, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Aktivität löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.activitiesService.removeScoped(id, req.user);
  }
}
