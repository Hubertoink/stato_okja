import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const TEST_DATA_PRESETS = ['small', 'realistic', 'large'] as const;

export type TestDataPreset = (typeof TEST_DATA_PRESETS)[number];

export class GenerateTestDataDto {
  @IsOptional()
  @IsIn(TEST_DATA_PRESETS)
  preset?: TestDataPreset;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  projects?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(25000)
  activities?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  monthsBack?: number;

  @IsOptional()
  @IsBoolean()
  clearExisting?: boolean;
}