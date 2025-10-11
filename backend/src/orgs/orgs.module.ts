import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Location } from '../locations/entities/location.entity';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Location])],
  controllers: [OrgsController],
  providers: [OrgsService],
  exports: [OrgsService],
})
export class OrgsModule {}
