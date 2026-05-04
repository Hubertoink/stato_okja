import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  CustomKpiDateMode,
  CustomKpiMetric,
  CustomKpiSurface,
} from '../entities/custom-kpi.entity';

export const CUSTOM_KPI_SURFACES: CustomKpiSurface[] = ['dashboard', 'statistics', 'both'];
export const CUSTOM_KPI_DATE_MODES: CustomKpiDateMode[] = [
  'inherit',
  'current_month',
  'current_year',
  'rolling_weeks',
];
export const CUSTOM_KPI_METRICS: CustomKpiMetric[] = [
  'activity_count',
  'participant_total',
  'duration_hours',
  'duration_hours_per_week',
  'avg_participants_per_activity',
  'participants_per_hour',
  'female_total',
  'female_share_percent',
  'male_total',
  'diverse_total',
];

export class CustomKpiFiltersDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  executionStatuses?: string[];

  @IsOptional()
  weekdays?: number[];
}

export class CreateCustomKpiDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsIn(CUSTOM_KPI_SURFACES)
  surface!: CustomKpiSurface;

  @IsIn(CUSTOM_KPI_METRICS)
  metric!: CustomKpiMetric;

  @IsOptional()
  @IsIn(CUSTOM_KPI_DATE_MODES)
  dateMode?: CustomKpiDateMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(104)
  rollingWeeks?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  backgroundColor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsObject()
  filters?: CustomKpiFiltersDto | null;
}

export class UpdateCustomKpiDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsIn(CUSTOM_KPI_SURFACES)
  surface?: CustomKpiSurface;

  @IsOptional()
  @IsIn(CUSTOM_KPI_METRICS)
  metric?: CustomKpiMetric;

  @IsOptional()
  @IsIn(CUSTOM_KPI_DATE_MODES)
  dateMode?: CustomKpiDateMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(104)
  rollingWeeks?: number | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  backgroundColor?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsObject()
  filters?: CustomKpiFiltersDto | null;
}
