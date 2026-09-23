import { IsEnum, IsIn, IsString, Length } from 'class-validator';
import { CatalogCategory, catalogCategories } from '../../sources/source.types';

export enum LibraryStateInput {
  Planned = 'planned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Dropped = 'dropped',
}

export class CreateLibraryEntryDto {
  @IsString()
  @Length(1, 100)
  externalId!: string;

  @IsIn(catalogCategories)
  category!: CatalogCategory;

  @IsString()
  @Length(2, 30)
  source!: string;

  @IsEnum(LibraryStateInput)
  state: LibraryStateInput = LibraryStateInput.Planned;
}
