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
import { LocationsService } from './locations.service';
import { Location } from './entities/location.entity';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Standorte/Räume abrufen' })
  findAll(@Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.locationsService.findAll(isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Standort nach ID abrufen' })
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Neuen Standort anlegen' })
  create(@Body() data: Partial<Location>) {
    return this.locationsService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Standort bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Location>) {
    return this.locationsService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Standort löschen' })
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}
