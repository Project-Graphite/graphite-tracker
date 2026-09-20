import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { BrowseCatalogDto } from './browse-catalog.dto';

export class SearchCatalogDto extends BrowseCatalogDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => String(value).trim())
  query!: string;
}
