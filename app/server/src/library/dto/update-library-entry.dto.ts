import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsOptionalNotNull } from '../../validation/is-optional-not-null.decorator';
import { LibraryStateInput } from './create-library-entry.dto';

export class UpdateLibraryEntryDto {
  @IsOptionalNotNull()
  @IsEnum(LibraryStateInput)
  state?: LibraryStateInput;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  progressSeason?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  progressEpisode?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  progressChapter?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  progressVolume?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  hoursPlayed?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercentage?: number | null;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  platforms?: string[];

  @IsOptionalNotNull()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 30)
  preferredSource?: string | null;
}
