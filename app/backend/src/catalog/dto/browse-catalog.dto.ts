import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BrowseCatalogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page = 1;
}
