import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';
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

  /** A password turns this into a directly provisioned account (no e-mail required). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
