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

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Cohort, Category, CustomKpi]), OrgsModule],
  controllers: [StatsController, CustomKpisController],
  providers: [StatsService, CustomKpisService, OrgScopeGuard],
})
export class StatsModule {}
