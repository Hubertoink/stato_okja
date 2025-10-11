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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { Activity } from './entities/activity.entity';

@ApiTags('activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Aktivitäten abrufen (mit Filtern)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.activitiesService.findAll({ from, to, type, locationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Aktivität nach ID abrufen' })
  findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Aktivität anlegen' })
  create(@Body() data: Partial<Activity>) {
    return this.activitiesService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Aktivität bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Activity>) {
    return this.activitiesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Aktivität löschen' })
  remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }
}
