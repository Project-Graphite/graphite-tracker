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
  @IsInt({ message: 'Season must be a whole number.' })
  @Min(0, { message: 'Season cannot be negative.' })
  @Max(1_000_000, { message: 'Season is too large.' })
  progressSeason?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Episode must be a whole number.' })
  @Min(0, { message: 'Episode cannot be negative.' })
  @Max(1_000_000, { message: 'Episode is too large.' })
  progressEpisode?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Chapter can have up to two decimals.' })
  @Min(0, { message: 'Chapter cannot be negative.' })
  @Max(99_999_999.99, { message: 'Chapter is too large.' })
  progressChapter?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Volume can have up to two decimals.' })
  @Min(0, { message: 'Volume cannot be negative.' })
  @Max(99_999_999.99, { message: 'Volume is too large.' })
  progressVolume?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Hours played can have up to two decimals.' })
  @Min(0, { message: 'Hours played cannot be negative.' })
  @Max(99_999_999.99, { message: 'Hours played is too large.' })
  hoursPlayed?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Completion must be a whole number.' })
  @Min(0, { message: 'Completion cannot be negative.' })
  @Max(100, { message: 'Completion is too large.' })
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
