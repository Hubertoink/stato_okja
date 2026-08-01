import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { OrgMasterDataService } from './org-master-data.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Location,
      Category,
      Tag,
      Cohort,
      Activity,
      Project,
      User,
      AuditLog,
    ]),
  ],
  controllers: [OrgsController],
  providers: [OrgsService, OrgMasterDataService],
  exports: [OrgsService],
})
export class OrgsModule {}
