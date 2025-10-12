import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { Location } from './entities/location.entity';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Location]), OrgsModule],
  controllers: [LocationsController],
  providers: [LocationsService, OrgScopeGuard],
  exports: [LocationsService],
})
export class LocationsModule {}
