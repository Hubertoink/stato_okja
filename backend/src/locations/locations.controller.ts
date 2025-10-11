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
import { LocationsService } from './locations.service';
import { Location } from './entities/location.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('locations')
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Standorte/Räume abrufen' })
  findAll(@Req() req: { user: { role: string; orgId?: string|null } }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = req.user.role === 'superadmin' ? null : (req.user.orgId || null);
    return this.locationsService.findAll(isActive, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Standort nach ID abrufen' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.locationsService.findOneScoped(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Neuen Standort anlegen' })
  create(@Body() data: Partial<Location>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const bodyOrgId = (data as Partial<Location> & { orgId?: string | null }).orgId ?? null;
    const orgId = req.user.role === 'superadmin' ? bodyOrgId : (req.user.orgId || null);
    return this.locationsService.create({ ...data, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Standort bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Location>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.locationsService.updateScoped(id, data, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Standort löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.locationsService.removeScoped(id, req.user);
  }
}
