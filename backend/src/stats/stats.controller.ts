import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('stats')
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'KPI-Zusammenfassung' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getSummary(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgId = req.user.role === 'superadmin' ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null)) : (req.user.orgId || null);
    return this.statsService.getSummary(from, to, orgId);
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Verteilung nach Tätigkeitstyp' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByType(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgId = req.user.role === 'superadmin' ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null)) : (req.user.orgId || null);
    return this.statsService.getByType(from, to, orgId);
  }

  @Get('gender')
  @ApiOperation({ summary: 'Geschlechterverteilung (Summen)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getGender(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgId = req.user.role === 'superadmin' ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null)) : (req.user.orgId || null);
    return this.statsService.getGender(from, to, orgId);
  }

  @Get('participants-timeseries')
  @ApiOperation({ summary: 'Zeitverlauf der Teilnehmenden (pro Tag)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getParticipantsTimeseries(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgId = req.user.role === 'superadmin' ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null)) : (req.user.orgId || null);
    return this.statsService.getParticipantsTimeseries(from, to, orgId);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Verteilung nach Kategorien' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByCategory(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgId = req.user.role === 'superadmin' ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null)) : (req.user.orgId || null);
    return this.statsService.getByCategory(from, to, orgId);
  }

  @Get('by-cohort')
  @ApiOperation({ summary: 'Verteilung nach Alterskohorten' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByCohort(
    @Req() req: { user: { role: string; orgId?: string|null } },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orgId') orgIdQuery?: string,
  ) {
    const orgId = req.user.role === 'superadmin' ? (typeof orgIdQuery === 'undefined' ? undefined : (orgIdQuery || null)) : (req.user.orgId || null);
    return this.statsService.getByCohort(from, to, orgId);
  }
}
