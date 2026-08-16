import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { CreateProcessDto, UpdateProcessDto } from './dto/process.dto';
import { ProcessesService } from './processes.service';

type ProcessRequest = {
  user: { id?: string; name?: string | null; role: string; orgId?: string | null };
  effectiveOrgId?: string | null | undefined;
};

@ApiTags('processes')
@Controller('processes')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get('access')
  @ApiOperation({ summary: 'Liefert Freischaltung und Rollenrechte für ProzessO im aktiven Organisationskontext' })
  access(@Req() req: ProcessRequest) {
    return this.processes.access({ ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Get()
  @ApiOperation({ summary: 'Listet Prozessvorlagen der aktiven Organisation' })
  list(@Req() req: ProcessRequest) {
    return this.processes.list({ ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Post()
  @ApiOperation({ summary: 'Legt eine Prozessvorlage an' })
  create(@Body() body: CreateProcessDto, @Req() req: ProcessRequest) {
    return this.processes.create(body, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Bearbeitet eine Prozessvorlage' })
  update(@Param('id') id: string, @Body() body: UpdateProcessDto, @Req() req: ProcessRequest) {
    return this.processes.update(id, body, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Löscht eine Prozessvorlage' })
  remove(@Param('id') id: string, @Req() req: ProcessRequest) {
    return this.processes.remove(id, { ...req.user, effectiveOrgId: req.effectiveOrgId });
  }
}
