import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgsModule } from '../orgs/orgs.module';
import { ProjectTemplate } from './entities/project-template.entity';
import { ProjectTemplatesController } from './project-templates.controller';
import { ProjectTemplatesService } from './project-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectTemplate]), OrgsModule],
  controllers: [ProjectTemplatesController],
  providers: [ProjectTemplatesService],
  exports: [ProjectTemplatesService],
})
export class ProjectTemplatesModule {}
