import { IsEnum, IsIn, IsString, Length } from 'class-validator';

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

  @IsIn(['movie', 'tv', 'anime', 'manga', 'manhwa', 'game'])
  category!: 'movie' | 'tv' | 'anime' | 'manga' | 'manhwa' | 'game';

  @IsString()
  @Length(2, 30)
  source!: string;

  @IsEnum(LibraryStateInput)
  state: LibraryStateInput = LibraryStateInput.Planned;
}
