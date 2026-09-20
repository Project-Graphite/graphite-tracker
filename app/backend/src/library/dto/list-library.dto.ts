import { IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';
import {
  LibraryStateInput,
} from './create-library-entry.dto';

export class ListLibraryDto {
  @IsOptional()
  @IsIn(['movie', 'tv', 'anime', 'manga', 'manhwa', 'game'])
  category?: 'movie' | 'tv' | 'anime' | 'manga' | 'manhwa' | 'game';

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
