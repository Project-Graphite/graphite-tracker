import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class SearchCatalogDto {
  @IsString()
  @Length(2, 100)
  @Transform(({ value }) => String(value).trim())
  query!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page = 1;
}
