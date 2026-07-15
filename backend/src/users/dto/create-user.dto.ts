import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import type { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsIn(['superadmin', 'org_admin', 'user'])
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  orgId?: string | null;
}
