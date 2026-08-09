import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { resolveOrgScope } from '../auth/org-scope-access';
import { LogbookService } from './logbook.service';

type RequestShape = { user: { id: string; name?: string | null; role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined };

@ApiTags('logbook')
@Controller('logbook')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class LogbookController {
  constructor(private readonly logbook: LogbookService) {}

  private scope(req: RequestShape) {
    return resolveOrgScope({ ...req.user, effectiveOrgId: req.effectiveOrgId });
  }

  @Get()
  @ApiOperation({ summary: 'Logbucheinträge der aktiven Organisation' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @Req() req: RequestShape,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('authorId') authorId?: string,
    @Query('activityId') activityId?: string,
    @Query('projectId') projectId?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.logbook.list(this.scope(req), req.user, {
      search, from, to, type, status, authorId, activityId, projectId,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Logbucheintrag erstellen' })
  create(@Req() req: RequestShape, @Body() body: Record<string, unknown>) {
    return this.logbook.create(body, this.scope(req), req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Logbucheintrag mit Kommentaren laden' })
  findOne(@Param('id') id: string, @Req() req: RequestShape) {
    return this.logbook.findOne(id, this.scope(req), req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Logbucheintrag bearbeiten' })
  update(@Param('id') id: string, @Req() req: RequestShape, @Body() body: Record<string, unknown>) {
    return this.logbook.update(id, body, this.scope(req), req.user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Status eines Logbucheintrags setzen' })
  setStatus(@Param('id') id: string, @Req() req: RequestShape, @Body() body: { status?: unknown }) {
    return this.logbook.setStatus(id, body.status, this.scope(req), req.user);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Archivierten Logbucheintrag wiederherstellen' })
  restore(@Param('id') id: string, @Req() req: RequestShape) {
    return this.logbook.restore(id, this.scope(req), req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Logbucheintrag archivieren' })
  archive(@Param('id') id: string, @Req() req: RequestShape) {
    return this.logbook.archive(id, this.scope(req), req.user);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Kommentar zu einem Logbucheintrag erstellen' })
  createComment(@Param('id') id: string, @Req() req: RequestShape, @Body() body: { body?: unknown }) {
    return this.logbook.createComment(id, body.body, this.scope(req), req.user);
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Kommentar löschen' })
  removeComment(@Param('id') id: string, @Param('commentId') commentId: string, @Req() req: RequestShape) {
    return this.logbook.removeComment(id, commentId, this.scope(req), req.user);
  }
}
