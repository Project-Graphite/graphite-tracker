import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { BrowseCatalogDto } from './browse-catalog.dto';

export class SearchCatalogDto extends BrowseCatalogDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  query!: string;
}
