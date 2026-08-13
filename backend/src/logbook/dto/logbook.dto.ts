import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { LogbookEntryStatus, LogbookEntryType, LogbookVisibility } from '../../common/enums';

export class CreateLogbookEntryDto {
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsEnum(LogbookEntryType) type?: LogbookEntryType;
  @IsString() @MaxLength(180) title!: string;
  @IsString() @MaxLength(12_000) body!: string;
  @IsOptional() @IsString() @MaxLength(6_000) highlights?: string | null;
  @IsOptional() @IsString() @MaxLength(6_000) challenges?: string | null;
  @IsOptional() @IsString() @MaxLength(6_000) nextSteps?: string | null;
  @IsOptional() @IsEnum(LogbookEntryStatus) status?: LogbookEntryStatus;
  @IsOptional() @IsEnum(LogbookVisibility) visibility?: LogbookVisibility;
  @IsOptional() @IsUUID() activityId?: string | null;
  @IsOptional() @IsUUID() projectId?: string | null;
}
export class UpdateLogbookEntryDto extends PartialType(CreateLogbookEntryDto) {}

export class UpdateLogbookStatusDto {
  @IsEnum(LogbookEntryStatus) status!: LogbookEntryStatus;
}

export class CreateLogbookCommentDto {
  @IsString() @MaxLength(4_000) body!: string;
}
