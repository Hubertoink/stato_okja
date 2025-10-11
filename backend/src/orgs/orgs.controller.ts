import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrgsService } from './orgs.service';

@Controller('orgs')
export class OrgsController {
  constructor(private readonly service: OrgsService) {}

  @Get()
  list() { return this.service.findAll(); }

  @Post()
  create(@Body() body: { name: string }) { return this.service.create(body?.name); }
}
