import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AccountProvisioningPolicy } from '../entities/system-settings.entity';

export class UpdateSystemSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  orgName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  loginSubtitle?: string | null;

  @IsOptional()
  @IsIn(['invite', 'admin_password', 'both'])
  accountProvisioningPolicy?: AccountProvisioningPolicy;
}
