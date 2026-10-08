import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ActivityType } from '../../common/enums';
import type { AnnualTargetMetric, AnnualTargetRule } from '../entities/annual-target.entity';

export class AnnualTargetScopeDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(ActivityType, { each: true })
  types?: string[];
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() activityId?: string;
}

// Full replacement of the editable definition; lifecycle fields are separate commands.
export class AnnualTargetDto {
  @IsString() @IsNotEmpty() @MaxLength(120) title!: string;
  @IsInt() @Min(2000) @Max(2200) year!: number;
  @IsIn([
    'duration_hours',
    'participant_total',
    'activity_count',
    'female_share_percent',
    'male_share_percent',
    'diverse_share_percent',
  ])
  metric!: AnnualTargetMetric;
  @IsObject() @ValidateNested() @Type(() => AnnualTargetScopeDto) scope!: AnnualTargetScopeDto;
  @IsIn(['min', 'max', 'range']) rule!: AnnualTargetRule;
  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0) @Max(1e9) target!: number;
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1e9)
  upperTarget?: number | null;
  @IsString() @MaxLength(4000) description!: string;
  @IsBoolean() showOnDashboard!: boolean;
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}

export class AnnualTargetCommandDto {
  @IsInt() @Min(1) version!: number;
  @IsIn(['activate', 'close', 'reopen']) action!: 'activate' | 'close' | 'reopen';
  @IsString() @MaxLength(4000) reason!: string;
}

export class AnnualTargetCopyDto {
  @IsInt() @Min(2000) @Max(2200) year!: number;
}
