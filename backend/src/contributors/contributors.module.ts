import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contributor } from './contributor.entity';
import { Activity } from '../activities/entities/activity.entity';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { ContributorsController } from './contributors.controller';
import { ContributorsService } from './contributors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Contributor, Activity]), OrgsModule],
  controllers: [ContributorsController],
  providers: [ContributorsService, OrgScopeGuard],
})
export class ContributorsModule {}
