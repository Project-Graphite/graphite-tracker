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
  @Length(1, 80)
  displayName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptionalNotNull()
  @IsString()
  @MaxLength(64)
  @IsTimeZone()
  timeZone?: string;
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
