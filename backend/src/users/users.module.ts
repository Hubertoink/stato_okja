import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Organization } from '../orgs/entities/organization.entity';
import { forwardRef } from '@nestjs/common';
import { OrgsModule } from '../orgs/orgs.module';
import { OrgScopeGuard } from '../auth/org-scope.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, Organization, OrganizationMembership]), forwardRef(() => OrgsModule)],
  controllers: [UsersController],
  providers: [UsersService, OrgScopeGuard],
  exports: [UsersService],
})
export class UsersModule {}
