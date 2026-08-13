import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './entities/activity.entity';
import { Attachment } from './entities/attachment.entity';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Project } from '../projects/entities/project.entity';
import { Location } from '../locations/entities/location.entity';
import { AuditModule } from '../common/audit.module';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { ActivityAck } from './entities/activity-ack.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activity, Attachment, Tag, Category, Cohort, Staff, Project, Location, ActivityAck]),
    AuditModule,
    OrgsModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, OrgScopeGuard],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
