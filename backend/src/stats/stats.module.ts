import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { CustomKpisController } from './custom-kpis.controller';
import { CustomKpisService } from './custom-kpis.service';
import { Activity } from '../activities/entities/activity.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { CustomKpi } from './entities/custom-kpi.entity';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { AnnualTarget } from './entities/annual-target.entity';
import { AnnualTargetsController } from './annual-targets.controller';
import { AnnualTargetsService } from './annual-targets.service';
import { Project } from '../projects/entities/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Cohort, Category, CustomKpi, AnnualTarget, Project]), OrgsModule],
  controllers: [StatsController, CustomKpisController, AnnualTargetsController],
  providers: [StatsService, CustomKpisService, AnnualTargetsService, OrgScopeGuard],
})
export class StatsModule {}
