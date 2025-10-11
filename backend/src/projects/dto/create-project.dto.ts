import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ActivityType } from '../../common/enums';

export class CreateProjectDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  // Mehrfachkategorien (optional)
  @IsOptional()
  @IsArray()
  categoryIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetGroup?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  defaultStartTime?: string;

  @IsOptional()
  @IsString()
  defaultEndTime?: string;

  @IsOptional()
  @IsString()
  defaultStaff?: string;

  @IsOptional()
  @IsString()
  defaultVolunteers?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  activityField?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
