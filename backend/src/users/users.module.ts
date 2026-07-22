import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Organization } from '../orgs/entities/organization.entity';
import { forwardRef } from '@nestjs/common';
import { OrgsModule } from '../orgs/orgs.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization]), forwardRef(() => OrgsModule), SystemSettingsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
