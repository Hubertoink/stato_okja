import { IsString, MinLength } from 'class-validator';

export class ConfirmSystemDataOperationDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @MinLength(1)
  confirmationText!: string;
}