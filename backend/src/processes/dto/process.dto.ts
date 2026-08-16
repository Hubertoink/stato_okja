import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PROCESS_NODE_TYPES, type ProcessDefinition } from '../entities/process.entity';

export class ProcessNodePositionDto {
  @IsNumber({ allowNaN: false, allowInfinity: false }) x!: number;
  @IsNumber({ allowNaN: false, allowInfinity: false }) y!: number;
}

export class ProcessNodeDataDto {
  @IsString() @MaxLength(180) label!: string;
  @IsOptional() @IsString() @MaxLength(8_000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) responsibleRole?: string;
}

export class ProcessDefinitionNodeDto {
  @IsString() @MaxLength(120) id!: string;
  @IsIn(PROCESS_NODE_TYPES) type!: (typeof PROCESS_NODE_TYPES)[number];
  @ValidateNested() @Type(() => ProcessNodePositionDto) position!: ProcessNodePositionDto;
  @ValidateNested() @Type(() => ProcessNodeDataDto) data!: ProcessNodeDataDto;
}

export class ProcessDefinitionEdgeDto {
  @IsString() @MaxLength(120) id!: string;
  @IsString() @MaxLength(120) source!: string;
  @IsString() @MaxLength(120) target!: string;
  @IsOptional() @IsString() @MaxLength(180) label?: string;
}

export class ProcessDefinitionDto implements ProcessDefinition {
  @IsInt() @Min(1) schemaVersion!: 1;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ProcessDefinitionNodeDto)
  nodes!: ProcessDefinitionNodeDto[];
  @IsArray() @ArrayMaxSize(400) @ValidateNested({ each: true }) @Type(() => ProcessDefinitionEdgeDto)
  edges!: ProcessDefinitionEdgeDto[];
}

export class CreateProcessDto {
  @IsString() @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(8_000) purpose?: string | null;
  @IsOptional() @ValidateNested() @Type(() => ProcessDefinitionDto) definition?: ProcessDefinitionDto;
}

export class UpdateProcessDto {
  @IsOptional() @IsString() @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(8_000) purpose?: string | null;
  @IsOptional() @ValidateNested() @Type(() => ProcessDefinitionDto) definition?: ProcessDefinitionDto;
}
