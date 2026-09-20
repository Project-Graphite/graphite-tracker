import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class BrowseCatalogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page = 1;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  genre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  year?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  status?: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  source?: string;

  @IsOptional()
  @IsIn([
    'popularity.desc',
    'vote_average.desc',
    'primary_release_date.desc',
    'first_air_date.desc',
    'relevance',
    'followedCount',
    'latestUploadedChapter',
  ])
  sort?: string;
}
