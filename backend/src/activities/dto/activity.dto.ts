import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ActivityExecutionStatus, ActivityType } from '../../common/enums';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class ActivityCohortDto {
  @IsUUID()
  cohortId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  m?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  w?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  d?: number;
}

export class CreateActivityDto {
  @IsDateString()
  date!: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Matches(TIME_PATTERN)
  startTime?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Matches(TIME_PATTERN)
  endTime?: string | null;

  @IsOptional()
  @IsEnum(ActivityExecutionStatus)
  executionStatus?: ActivityExecutionStatus;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  projectId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(300)
  title?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(20_000)
  goals?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  countMale?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  countFemale?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  countDiverse?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  countTotal?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  staffIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ActivityCohortDto)
  cohorts?: ActivityCohortDto[];
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class UpdateActivityAckDto {
  @IsBoolean()
  done!: boolean;
}
