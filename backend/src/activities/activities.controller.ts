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
import { OrgsService } from '../orgs/orgs.service';
import { Activity } from './entities/activity.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';

function csvToWeekdays(value?: string): number[] | undefined {
  if (!value) return undefined;
  const weekdays = Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6),
    ),
  ).sort((left, right) => left - right);
  return weekdays.length > 0 ? weekdays : undefined;
}

@ApiTags('activities')
@Controller('activities')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly orgs: OrgsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Alle Aktivitäten abrufen (mit Filtern)' })
  @ApiQuery({ name: 'search', required: false, description: 'Textsuche in Aktivitätstitel und Projektname' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'types', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'locationIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'projectIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'categoryIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'uncategorized', required: false, description: 'Nur Aktivitäten ohne Kategorien' })
  @ApiQuery({ name: 'tagIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'staffIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'cohortIds', required: false, description: 'CSV Liste' })
  @ApiQuery({ name: 'weekdays', required: false, description: 'CSV Liste von Wochentagen (0=So bis 6=Sa)' })
  @ApiQuery({ name: 'hasNotes', required: false })
  @ApiQuery({ name: 'participantsMin', required: false })
  @ApiQuery({ name: 'participantsMax', required: false })
  @ApiQuery({ name: 'durationMin', required: false })
  @ApiQuery({ name: 'durationMax', required: false })
  @ApiQuery({
    name: 'order',
    required: false,
    description: "Sortierreihenfolge für Datum (asc|desc); Standard 'desc'",
  })
  @ApiQuery({ name: 'page', required: false, description: '1-basierte Seite für Paginierung' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Anzahl je Seite (max 50, Standard 50)',
  })
  async findAll(
    @Req()
    req: {
      user: { role: string; orgId?: string | null };
      effectiveOrgId?: string | null | undefined;
    },
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('types') typesCsv?: string,
    @Query('locationId') locationId?: string,
    @Query('locationIds') locationIdsCsv?: string,
    @Query('projectIds') projectIdsCsv?: string,
    @Query('categoryIds') categoryIdsCsv?: string,
    @Query('uncategorized') uncategorized?: string, // Added support for filtering uncategorized activities
    @Query('tagIds') tagIdsCsv?: string,
    @Query('cohortIds') cohortIdsCsv?: string,
    @Query('weekdays') weekdaysCsv?: string,
    @Query('staffIds') staffIdsCsv?: string,
    @Query('hasNotes') hasNotes?: string,
    @Query('participantsMin') participantsMin?: string,
    @Query('participantsMax') participantsMax?: string,
    @Query('durationMin') durationMin?: string,
    @Query('durationMax') durationMax?: string,
    @Query('order') order?: string,
    @Query('orgId') orgIdQuery?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    // Determine organization filter from scope
    // Superadmin:
    //   - effectiveOrgId === undefined -> treat as null (global intentionally disabled)
    //   - effectiveOrgId === null (root/no-org) -> filter by orgId IS NULL
    //   - effectiveOrgId === string -> filter by that org's subtree
    // Others: always filter by effectiveOrgId (or user.orgId as fallback)
    let orgId: string | null | undefined = undefined;
    let orgIds: string[] | undefined = undefined;
    
    if (req.user.role === 'superadmin') {
      // Check if orgIdQuery param overrides header
      if (typeof orgIdQuery !== 'undefined') {
        const oid = orgIdQuery || null;
        if (typeof oid === 'string') {
          orgIds = await this.orgs.getSubtreeOrgIds(oid);
        } else {
          orgId = null; // Filter by null org
        }
      } else if (typeof req.effectiveOrgId === 'undefined' || req.effectiveOrgId === null) {
        // Root/no-org selected
        orgId = null;
      } else {
        // Specific org selected
        orgIds = await this.orgs.getSubtreeOrgIds(req.effectiveOrgId);
      }
    } else {
      // Non-superadmin: use effectiveOrgId or fallback to user.orgId
      const oid = typeof req.effectiveOrgId === 'undefined' ? (req.user.orgId || null) : req.effectiveOrgId;
      if (typeof oid === 'string') {
        orgIds = await this.orgs.getSubtreeOrgIds(oid);
      } else {
        orgId = null;
      }
    }
    const csvToArray = (s?: string) =>
      s
        ? s
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : undefined;
    const page = pageStr ? Math.max(parseInt(pageStr, 10) || 1, 1) : undefined;
    const limitParsed = limitStr ? parseInt(limitStr, 10) || 50 : 50;
    const limit = Math.min(Math.max(limitParsed, 1), 50);

    const filters = {
      search: search?.trim() ? search.trim() : undefined,
      from,
      to,
      type,
      types: csvToArray(typesCsv),
      locationId,
      locationIds: csvToArray(locationIdsCsv),
      projectIds: csvToArray(projectIdsCsv),
      categoryIds: csvToArray(categoryIdsCsv),
      uncategorized: typeof uncategorized !== 'undefined' ? uncategorized === 'true' || uncategorized === '1' : undefined, // Added filtering logic for uncategorized
      tagIds: csvToArray(tagIdsCsv),
      staffIds: csvToArray(staffIdsCsv),
      cohortIds: csvToArray(cohortIdsCsv),
      weekdays: csvToWeekdays(weekdaysCsv),
      hasNotes:
        typeof hasNotes !== 'undefined' ? hasNotes === 'true' || hasNotes === '1' : undefined,
      participantsMin: participantsMin ? parseInt(participantsMin, 10) : undefined,
      participantsMax: participantsMax ? parseInt(participantsMax, 10) : undefined,
      durationMin: durationMin ? parseInt(durationMin, 10) : undefined,
      durationMax: durationMax ? parseInt(durationMax, 10) : undefined,
      orgId,
      orgIds,
      order:
        order && (order.toLowerCase() === 'asc' || order.toLowerCase() === 'desc')
          ? (order.toLowerCase() as 'asc' | 'desc')
          : undefined,
    } as const;

    // Wenn page gesetzt ist, paginierte Antwort liefern, sonst alle (bestehendes Verhalten)
    if (typeof page !== 'undefined') {
      return this.activitiesService.findAllPaged({ ...filters, page, limit });
    }
    return this.activitiesService.findAll(filters);
  }

  // Acknowledgments (Daily Log "done" flag)
  @Get('acks')
  @ApiOperation({ summary: 'Ack-Status (done) für eine Liste von Aktivitäten abrufen' })
  @ApiQuery({ name: 'activityIds', required: true, description: 'CSV Liste von Activity-IDs' })
  async getAcks(
    @Req()
    req: {
      user: { role: string; orgId?: string | null };
      effectiveOrgId?: string | null | undefined;
    },
    @Query('activityIds') activityIdsCsv: string,
  ) {
    const ids = (activityIdsCsv || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (ids.length === 0) return {};

    // Determine org filter similar to findAll
    // Note: global scope is disabled; undefined behaves like null.
    const superAdminScoped = typeof req.effectiveOrgId === 'undefined' ? null : req.effectiveOrgId;
    const orgIdRaw =
      req.user.role === 'superadmin'
        ? typeof superAdminScoped === 'undefined'
          ? null
          : superAdminScoped
        : typeof req.effectiveOrgId === 'undefined'
          ? req.user.orgId || null
          : req.effectiveOrgId;

    let orgId: string | null | undefined = orgIdRaw;
    let orgIds: string[] | undefined = undefined;
    if (typeof orgIdRaw === 'string') {
      orgIds = await this.orgs.getSubtreeOrgIds(orgIdRaw);
      orgId = undefined;
    }
    return this.activitiesService.getAcks(ids, { orgId, orgIds });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Aktivität nach ID abrufen' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string | null } }) {
    return this.activitiesService.findOneScoped(id, req.user);
  }

  @Patch(':id/ack')
  @ApiOperation({ summary: 'Ack-Status (done) für eine Aktivität setzen' })
  async setAck(
    @Param('id') id: string,
    @Body() body: { done?: boolean },
    @Req()
    req: { user: { id?: string; role: string; orgId?: string | null; name?: string | null } },
  ) {
    const done = !!body?.done;
    const updated = await this.activitiesService.setAckScoped(id, done, {
      id: req.user.id,
      name: req.user.name || undefined,
      role: req.user.role,
      orgId: req.user.orgId ?? null,
    });
    return { activityId: id, done: !!updated?.ackDone };
  }

  @Post()
  @ApiOperation({ summary: 'Neue Aktivität anlegen' })
  create(
    @Body() data: Partial<Activity>,
    @Req()
    req: {
      user: { id: string; role: string; orgId?: string | null; name?: string | null };
      effectiveOrgId?: string | null | undefined;
    },
  ) {
    // Enforce orgId strictly from effective scope (ignore body)
    const scopeOrgId =
      req.user.role === 'superadmin'
        ? typeof req.effectiveOrgId === 'undefined'
          ? null
          : req.effectiveOrgId
        : typeof req.effectiveOrgId === 'undefined'
          ? req.user.orgId || null
          : req.effectiveOrgId;
    const orgId = scopeOrgId ?? null;
    return this.activitiesService.create(
      { ...data, orgId },
      { id: req.user.id, name: req.user.name || undefined, orgId },
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aktivität bearbeiten' })
  update(
    @Param('id') id: string,
    @Body() data: Partial<Activity>,
    @Req()
    req: {
      user: { id: string; role: string; orgId?: string | null; name?: string | null };
      effectiveOrgId?: string | null | undefined;
    },
  ) {
    // Never allow changing orgId via update (for all roles)
    // Drop orgId from payload and let service enforce scoping rules
    const rest: Partial<Activity> = { ...(data as Partial<Activity>) };
    delete (rest as Partial<Activity> & { orgId?: string | null }).orgId;
    return this.activitiesService.updateScoped(id, rest, {
      ...req.user,
      name: req.user.name || undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Aktivität löschen' })
  remove(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role: string; orgId?: string | null; name?: string | null } },
  ) {
    return this.activitiesService.removeScoped(id, {
      ...req.user,
      name: req.user.name || undefined,
    });
  }
}
