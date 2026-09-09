import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectDocument } from './entities/project-document.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Category } from '../taxonomy/entities/category.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AuditModule } from '../common/audit.module';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { UploadAccessModule } from '../uploads/upload-access.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectDocument, Category, Activity]), AuditModule, OrgsModule, UploadAccessModule],
  providers: [ProjectsService, OrgScopeGuard],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
