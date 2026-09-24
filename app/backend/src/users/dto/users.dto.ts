import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { CatalogCategory, catalogCategories } from '../../sources/source.types';
import { LibraryStateInput } from '../../library/dto/create-library-entry.dto';

export class UpdateProfileDto {
  @IsOptional()
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
}

export class UpdatePrivacyDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  showLibrary?: boolean;

  @IsOptional()
  @IsBoolean()
  showActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  showRatings?: boolean;

  @IsOptional()
  @IsBoolean()
  showReviews?: boolean;

  @IsOptional()
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
