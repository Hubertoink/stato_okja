import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { AuditModule } from '../common/audit.module';
import { OrgsModule } from '../orgs/orgs.module';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { LogbookController } from './logbook.controller';
import { LogbookService } from './logbook.service';
import { LogbookComment } from './entities/logbook-comment.entity';
import { LogbookEntry } from './entities/logbook-entry.entity';
import { LogbookEntryView } from './entities/logbook-entry-view.entity';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@Module({
  imports: [TypeOrmModule.forFeature([LogbookEntry, LogbookComment, LogbookEntryView, Activity, Project, User]), AuditModule, OrgsModule],
  controllers: [LogbookController],
  providers: [LogbookService, OrgScopeGuard],
  exports: [LogbookService],
})
export class LogbookModule {}
