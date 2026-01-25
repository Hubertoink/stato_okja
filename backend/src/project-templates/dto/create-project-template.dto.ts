import { IsBoolean, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { ActivityType } from '../../common/enums';

export class CreateProjectTemplateDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetGroup?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryName?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
