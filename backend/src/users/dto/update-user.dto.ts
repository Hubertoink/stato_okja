import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['superadmin', 'org_admin', 'editor', 'user'])
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  orgId?: string | null;
}
