import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadAccessModule } from './upload-access.module';
import { SystemDataModule } from '../system-data/system-data.module';
import { UploadMaintenanceService } from './upload-maintenance.service';

@Module({
  imports: [UploadAccessModule, SystemDataModule],
  controllers: [UploadsController],
  providers: [UploadMaintenanceService],
})
export class UploadsModule {}
