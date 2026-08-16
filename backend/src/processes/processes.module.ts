import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../common/audit.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';
import { OrgsModule } from '../orgs/orgs.module';
import { Process } from './entities/process.entity';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Process]), OrgsModule, AuditModule],
  controllers: [ProcessesController],
  providers: [ProcessesService, OrgScopeGuard],
})
export class ProcessesModule {}
