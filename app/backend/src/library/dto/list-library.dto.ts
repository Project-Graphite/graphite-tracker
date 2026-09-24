import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CatalogCategory, catalogCategories } from '../../sources/source.types';
import { LibraryStateInput } from './create-library-entry.dto';

export class ListLibraryDto {
  @IsOptional()
  @IsIn(catalogCategories)
  category?: CatalogCategory;

  @IsOptional()
  @IsEnum(LibraryStateInput)
  state?: LibraryStateInput;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  query?: string;

  @IsOptional()
  @IsIn(['updated', 'title', 'release'])
  sort = 'updated';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;
}

export class LookupLibraryDto {
  @IsString()
  @Length(3, 10_000)
  refs!: string;
}
