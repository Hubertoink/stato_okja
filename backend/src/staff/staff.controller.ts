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
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';

@ApiTags('staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Mitarbeitende abrufen' })
  findAll(@Query('active') active?: string) {
    const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
    return this.staffService.findAll(isActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mitarbeitende nach ID abrufen' })
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Neue Mitarbeitende anlegen' })
  create(@Body() data: Partial<Staff>) {
    return this.staffService.create(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mitarbeitende bearbeiten' })
  update(@Param('id') id: string, @Body() data: Partial<Staff>) {
    return this.staffService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Mitarbeitende löschen' })
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
