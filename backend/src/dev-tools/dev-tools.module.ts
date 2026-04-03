import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';
import { Project } from '../projects/entities/project.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Location } from '../locations/entities/location.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Organization } from '../orgs/entities/organization.entity';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { RolesGuard } from '../auth/roles.guard';
import { OrgsModule } from '../orgs/orgs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Activity, Category, Tag, Location, Staff, Cohort, Organization]),
    OrgsModule,
  ],
  controllers: [DevToolsController],
  providers: [DevToolsService, OrgScopeGuard, RolesGuard],
})
export class DevToolsModule {}