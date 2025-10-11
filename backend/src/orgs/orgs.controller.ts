import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orgs')
export class OrgsController {
  constructor(private readonly service: OrgsService) {}

  @Roles('superadmin')
  @Get()
  list() { return this.service.findAll(); }

  @Roles('superadmin')
  @Post()
  create(@Body() body: { name: string }) { return this.service.create(body?.name); }
}
