import { IsBoolean } from 'class-validator';

export class ArchiveProjectDto {
  @IsBoolean()
  archived!: boolean;
}
