import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CatalogCategory, catalogCategories } from '../../sources/source.types';
import { LibraryStateInput } from '../../library/dto/create-library-entry.dto';
import { IsOptionalNotNull } from '../../validation/is-optional-not-null.decorator';

export class UpdateProfileDto {
  @IsOptionalNotNull()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80, { message: 'Display names are 1 to 80 characters long.' })
  displayName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(500, { message: 'Bios are at most 500 characters long.' })
  bio?: string | null;

  @IsOptionalNotNull()
  @IsString()
  @MaxLength(64)
  @IsTimeZone({ message: 'Choose a time zone from the list.' })
  timeZone?: string;

  @IsOptionalNotNull()
  @IsBoolean()
  showAdultContent?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  blurAdultContent?: boolean;
}

export class UpdatePrivacyDto {
  @IsOptionalNotNull()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  showLibrary?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  showActivity?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  showRatings?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  showReviews?: boolean;

  @IsOptionalNotNull()
  @IsBoolean()
  showStatistics?: boolean;
}

export class ProfilePageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  page = 1;
}

export class ProfileLibraryDto extends ProfilePageDto {
  @IsOptional()
  @IsIn(catalogCategories)
  category?: CatalogCategory;

  @IsOptional()
  @IsEnum(LibraryStateInput)
  state?: LibraryStateInput;
}
