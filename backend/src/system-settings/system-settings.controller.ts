import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { SystemSettingsService } from './system-settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly settings: SystemSettingsService) {}

  @Get()
  get() { return this.settings.get(); }

  @Patch()
  update(@Body() body: UpdateSystemSettingsDto) { return this.settings.update(body || {}); }
}
