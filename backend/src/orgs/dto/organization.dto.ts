import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../../users/entities/user.entity';

export class CreateOrganizationDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
}

export class MoveOrganizationDto {
  @IsUUID() parentId!: string;
  @IsOptional() @IsBoolean() force?: boolean;
}

export class MasterDataContentDto {
  @IsString() @MaxLength(2_000_000) content!: string;
}

export class UpdateDefaultLocaleDto {
  @IsIn(SUPPORTED_LOCALES) locale!: SupportedLocale;
}

export class OpeningHoursDayDto {
  @IsBoolean() open!: boolean;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class UpdateOpeningHoursDto {
  @ValidateNested() @Type(() => OpeningHoursDayDto) monday!: OpeningHoursDayDto;
  @ValidateNested() @Type(() => OpeningHoursDayDto) tuesday!: OpeningHoursDayDto;
  @ValidateNested() @Type(() => OpeningHoursDayDto) wednesday!: OpeningHoursDayDto;
  @ValidateNested() @Type(() => OpeningHoursDayDto) thursday!: OpeningHoursDayDto;
  @ValidateNested() @Type(() => OpeningHoursDayDto) friday!: OpeningHoursDayDto;
  @ValidateNested() @Type(() => OpeningHoursDayDto) saturday!: OpeningHoursDayDto;
  @ValidateNested() @Type(() => OpeningHoursDayDto) sunday!: OpeningHoursDayDto;
}

export class UpsertClosureDayDto {
  @IsOptional() @IsString() from?: string | null;
  @IsOptional() @IsString() to?: string | null;
}

export class TaxonomyTypeSettingDto {
  @IsOptional() @IsBoolean() allowOwn?: boolean;
  @IsOptional() @IsBoolean() inheritAll?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('4', { each: true }) inheritedIds?: string[];
}

export class TaxonomySettingsDto {
  @IsOptional() @ValidateNested() @Type(() => TaxonomyTypeSettingDto) categories?: TaxonomyTypeSettingDto;
  @IsOptional() @ValidateNested() @Type(() => TaxonomyTypeSettingDto) tags?: TaxonomyTypeSettingDto;
  @IsOptional() @ValidateNested() @Type(() => TaxonomyTypeSettingDto) cohorts?: TaxonomyTypeSettingDto;
  @IsOptional() @IsBoolean() allowChildAdminOverrides?: boolean;
}

export class UpdateOrganizationTaxonomySettingsDto {
  @IsOptional() @ValidateNested() @Type(() => TaxonomySettingsDto) settings?: TaxonomySettingsDto | null;
  @IsOptional() @ValidateNested() @Type(() => TaxonomySettingsDto) childDefaults?: TaxonomySettingsDto | null;
}
