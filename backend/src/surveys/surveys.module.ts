import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Survey } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { SurveysService } from './surveys.service';
import { SurveysController, PublicSurveysController } from './surveys.controller';
import { AuditModule } from '../common/audit.module';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { Organization } from '../orgs/entities/organization.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Survey, SurveyResponse, Organization]), AuditModule, OrgsModule],
  providers: [SurveysService, OrgScopeGuard],
  controllers: [SurveysController, PublicSurveysController],
})
export class SurveysModule {}
