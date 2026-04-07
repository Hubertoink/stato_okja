import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { Tag } from '../taxonomy/entities/tag.entity';
import { Cohort } from '../taxonomy/entities/cohort.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Project } from '../projects/entities/project.entity';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Location, Category, Tag, Cohort, Activity, Project]), forwardRef(() => UsersModule)],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
