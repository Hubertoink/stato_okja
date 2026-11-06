import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Matches, ValidateIf } from 'class-validator';

export class CreateContributorDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class UpdateContributorDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}

export class ContributionReportQuery {
  @IsDateString({ strict: true })
  from!: string;

  @IsDateString({ strict: true })
  to!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
