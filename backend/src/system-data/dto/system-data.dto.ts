import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmSystemDataOperationDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  confirmationText!: string;
}

export class DeleteSystemDataUploadDto {
  @IsString()
  @MinLength(1)
  relativePath!: string;
}

export class DeleteSystemDataUploadsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  relativePaths!: string[];
}

/** Query parameters for the read-only Superadmin database explorer. */
export class DatabaseExplorerRowsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  sort?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';

  @IsOptional()
  @IsUUID()
  orgId?: string;
}
