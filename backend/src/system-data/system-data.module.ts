import { Module } from '@nestjs/common';
import { SystemDataController } from './system-data.controller';
import { SystemDataService } from './system-data.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../common/audit.module';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [SystemDataController],
  providers: [SystemDataService, RolesGuard],
})
export class SystemDataModule {}