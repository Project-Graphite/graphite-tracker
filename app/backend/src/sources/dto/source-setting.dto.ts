import { IsBoolean, IsIn, IsString, Length } from 'class-validator';

export class SourceSettingDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SourcePreferenceDto {
  @IsString()
  @Length(2, 30)
  source!: string;
}

export class CategorySourcePreferenceDto extends SourcePreferenceDto {
  @IsIn(['movie', 'tv', 'anime', 'manga', 'manhwa', 'game'])
  category!: 'movie' | 'tv' | 'anime' | 'manga' | 'manhwa' | 'game';
}
