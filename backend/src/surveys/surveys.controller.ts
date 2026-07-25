import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { resolveOrgScope } from '../auth/org-scope-access';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto, DeleteSurveyResponseDto, PublicSurveyResponseDto, UpdateSurveyDto } from './dto/survey.dto';

type SurveyRequest = { user: { id?: string; name?: string | null; role: string; orgId?: string | null }; effectiveOrgId?: string | null | undefined };

@ApiTags('surveys')
@Controller('surveys')
@UseGuards(JwtAuthGuard, OrgScopeGuard)
export class SurveysController {
  constructor(private readonly service: SurveysService) {}
  private actor(req: SurveyRequest) { return { ...req.user, effectiveOrgId: req.effectiveOrgId }; }

  @Get() findAll(@Req() req: SurveyRequest, @Query('search') search?: string, @Query('archived') archived?: string) {
    return this.service.findAll(resolveOrgScope(this.actor(req)), search, archived === 'true' ? true : archived === 'false' ? false : undefined);
  }
  @Get('meta/has-archived') hasArchived(@Req() req: SurveyRequest) { return this.service.hasArchived(resolveOrgScope(this.actor(req))); }
  @Post() create(@Body() body: CreateSurveyDto, @Req() req: SurveyRequest) { const actor = this.actor(req); return this.service.create(body, resolveOrgScope(actor), actor); }
  @Get(':id') findOne(@Param('id') id: string, @Req() req: SurveyRequest) { return this.service.findOneScoped(id, this.actor(req)); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: UpdateSurveyDto, @Req() req: SurveyRequest) { return this.service.update(id, body, this.actor(req)); }
  @Post(':id/start') start(@Param('id') id: string, @Req() req: SurveyRequest) { return this.service.start(id, this.actor(req)); }
  @Post(':id/close') close(@Param('id') id: string, @Req() req: SurveyRequest) { return this.service.close(id, this.actor(req)); }
  @Get(':id/responses') responses(@Param('id') id: string, @Req() req: SurveyRequest) { return this.service.listResponses(id, this.actor(req)); }
  @Delete(':id/responses/:responseId') deleteResponse(@Param('id') id: string, @Param('responseId') responseId: string, @Body() body: DeleteSurveyResponseDto, @Req() req: SurveyRequest) { return this.service.deleteResponse(id, responseId, body.reason, this.actor(req)); }
  @Get(':id/analytics') analytics(@Param('id') id: string, @Req() req: SurveyRequest) { return this.service.analytics(id, this.actor(req)); }
}

@ApiTags('public-surveys')
@Controller('public/surveys')
export class PublicSurveysController {
  constructor(private readonly service: SurveysService) {}
  @Get(':token') findOne(@Param('token') token: string) { return this.service.findPublic(token); }
  @Post(':token/responses') submit(@Param('token') token: string, @Body() body: PublicSurveyResponseDto) { return this.service.submitPublic(token, body.answers, body.deviceToken); }
}
