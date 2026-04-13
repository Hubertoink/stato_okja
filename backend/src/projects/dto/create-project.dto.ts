import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Length, MaxLength, Min, ValidateIf } from 'class-validator';
import { ActivityType } from '../../common/enums';

export class CreateProjectDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  // Mehrfachkategorien (optional)
  @IsOptional()
  @IsArray()
  categoryIds?: string[];

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  @MaxLength(120)
  targetGroup?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsInt()
  @Min(0)
  imageSize?: number | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  color?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsDateString()
  dateFrom?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsDateString()
  dateTo?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  defaultStartTime?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  defaultEndTime?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  defaultStaff?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  defaultVolunteers?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  tag?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  activityField?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @ValidateIf((o, v) => v !== null)
  @IsString()
  @MaxLength(64)
  clientRequestId?: string | null;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
