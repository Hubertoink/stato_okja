import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgsModule } from '../orgs/orgs.module';
import { StoredUpload } from './stored-upload.entity';
import { UploadsService } from './uploads.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoredUpload]), OrgsModule],
  providers: [UploadsService],
  exports: [UploadsService, OrgsModule],
})
export class UploadAccessModule {}
