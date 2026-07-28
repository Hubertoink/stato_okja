import { IsAscii, IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsAscii()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class InitialSetupDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

export class VerifyTwoFactorDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string;

  @IsString()
  @Length(6, 20)
  code!: string;
}

export class ResendTwoFactorDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string;
}

export class InviteUserDto {
  @IsAscii()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsIn(['superadmin', 'org_admin', 'user'])
  role?: 'superadmin' | 'org_admin' | 'user';

  @IsOptional()
  @IsUUID()
  orgId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  orgName?: string;
}

export class CreateLocalUserDto {
  @IsAscii()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsIn(['superadmin', 'org_admin', 'user'])
  role?: 'superadmin' | 'org_admin' | 'user';

  @IsUUID()
  orgId!: string;

  @IsString()
  @MinLength(1)
  temporaryPassword!: string;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsBoolean()
  termsAccepted!: boolean;
}

export class RequestPasswordResetDto {
  @IsAscii()
  @IsEmail()
  @MaxLength(200)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class ValidateResetTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

export class AdminResetPasswordDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsIn(['email', 'temporary_password'])
  mode?: 'email' | 'temporary_password';

  @IsOptional()
  @IsString()
  temporaryPassword?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(1)
  newPassword!: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  theme?: string;
}
