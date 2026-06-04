import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

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