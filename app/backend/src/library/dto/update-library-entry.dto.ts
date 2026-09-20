import { Type } from 'class-transformer';
import {
  IsArray,
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
import { LibraryStateInput } from './create-library-entry.dto';

export class UpdateLibraryEntryDto {
  @IsOptional()
  @IsEnum(LibraryStateInput)
  state?: LibraryStateInput;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  progressSeason?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  progressEpisode?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  progressChapter?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  progressVolume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hoursPlayed?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercentage?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  platforms?: string[];

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(2, 30)
  preferredSource?: string;
}
