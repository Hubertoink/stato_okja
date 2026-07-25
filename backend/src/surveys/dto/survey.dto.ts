import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type { SurveyQuestionType } from '../entities/survey.entity';

const QUESTION_TYPES: SurveyQuestionType[] = ['single_choice', 'multiple_choice', 'scale', 'text'];

export class SurveyQuestionOptionDto {
  @IsString() @MaxLength(80) id!: string;
  @IsString() @MaxLength(180) label!: string;
}

export class SurveyQuestionDto {
  @IsString() @MaxLength(80) id!: string;
  @IsIn(QUESTION_TYPES) type!: SurveyQuestionType;
  @IsString() @MaxLength(500) label!: string;
  @IsOptional() @IsString() @MaxLength(500) hint?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => SurveyQuestionOptionDto) options?: SurveyQuestionOptionDto[];
  @IsOptional() @IsInt() @Min(1) @Max(10) scaleMin?: number;
  @IsOptional() @IsInt() @Min(2) @Max(10) scaleMax?: number;
  @IsOptional() @IsString() @MaxLength(100) scaleMinLabel?: string;
  @IsOptional() @IsString() @MaxLength(100) scaleMaxLabel?: string;
  @IsOptional() @IsIn(['age_cohort', 'gender', 'origin_area']) demographicKey?: 'age_cohort' | 'gender' | 'origin_area';
}

export class CreateSurveyDto {
  @IsString() @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) introduction?: string | null;
  @IsOptional() @IsUUID() projectId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => SurveyQuestionDto) questions?: SurveyQuestionDto[];
  @IsOptional() @IsBoolean() allowMultiplePerDevice?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(100000) expectedParticipants?: number | null;
  @IsOptional() @IsDateString() startsAt?: string | null;
  @IsOptional() @IsDateString() endsAt?: string | null;
}

export class UpdateSurveyDto extends CreateSurveyDto {
  @IsOptional() @IsIn(['draft', 'active', 'closed', 'archived']) status?: 'draft' | 'active' | 'closed' | 'archived';
  @IsOptional() @IsBoolean() archived?: boolean;
}

export class PublicSurveyResponseDto {
  @IsOptional() @IsString() @MaxLength(120) deviceToken?: string;
  @IsOptional() answers?: Record<string, string | string[] | number | null>;
}

export class DeleteSurveyResponseDto {
  @IsString() @MaxLength(240) reason!: string;
}
