import { PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional() @IsString() @MaxLength(120) standardRef?: string | null;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(32) color?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateTagDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(160, { each: true }) synonyms?: string[] | null;
  @IsOptional() @IsString() @MaxLength(32) color?: string | null;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class CreateCohortDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsInt() @Min(0) @Max(130) minAge!: number;
  @IsInt() @Min(0) @Max(130) maxAge!: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() inheritToChildren?: boolean;
}
export class UpdateCohortDto extends PartialType(CreateCohortDto) {}
