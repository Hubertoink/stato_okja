import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list() { return this.service.findAll(); }

  @Post()
  create(@Body() body: { email: string; name: string; role?: 'superadmin'|'org_admin'|'user'; orgId?: string|null; passwordHash?: string|null }) {
    return this.service.create(body);
  }
}
