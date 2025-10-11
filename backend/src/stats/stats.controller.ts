import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'KPI-Zusammenfassung' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getSummary(from, to);
  }

  @Get('by-type')
  @ApiOperation({ summary: 'Verteilung nach Tätigkeitstyp' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByType(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getByType(from, to);
  }

  @Get('gender')
  @ApiOperation({ summary: 'Geschlechterverteilung (Summen)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getGender(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getGender(from, to);
  }

  @Get('participants-timeseries')
  @ApiOperation({ summary: 'Zeitverlauf der Teilnehmenden (pro Tag)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getParticipantsTimeseries(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getParticipantsTimeseries(from, to);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Verteilung nach Kategorien' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getByCategory(from, to);
  }

  @Get('by-cohort')
  @ApiOperation({ summary: 'Verteilung nach Alterskohorten' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getByCohort(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getByCohort(from, to);
  }
}
