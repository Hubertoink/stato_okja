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
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('staff')
@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Mitarbeitende abrufen' })
  findAll(@Req() req: { user: { role: string; orgId?: string|null } }, @Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    const orgId = req.user.role === 'superadmin' ? null : (req.user.orgId || null);
    return this.staffService.findAll(isActive, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mitarbeitende nach ID abrufen' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.staffService.findOneScoped(id, req.user);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Mitarbeitende anlegen' })
  create(@Body() data: Partial<Staff>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    const orgId = req.user.role === 'superadmin' ? (data as any).orgId ?? null : (req.user.orgId || null);
    return this.staffService.create({ ...data, orgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mitarbeitende bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Staff>, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.staffService.updateScoped(id, data, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mitarbeitende löschen' })
  remove(@Param('id') id: string, @Req() req: { user: { role: string; orgId?: string|null } }) {
    return this.staffService.removeScoped(id, req.user);
  }
}
