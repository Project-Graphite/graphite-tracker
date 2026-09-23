import { IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { CatalogCategory, catalogCategories } from '../../sources/source.types';
import {
  LibraryStateInput,
} from './create-library-entry.dto';

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
}
