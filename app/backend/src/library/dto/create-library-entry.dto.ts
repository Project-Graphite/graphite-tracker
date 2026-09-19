import { IsEnum, IsString, Matches } from 'class-validator';

export enum LibraryStateInput {
  Planned = 'planned',
  InProgress = 'in_progress',
  Completed = 'completed',
  Dropped = 'dropped',
}

export class CreateLibraryEntryDto {
  @IsString()
  @Matches(/^\d+$/)
  externalId!: string;

  @IsEnum(LibraryStateInput)
  state: LibraryStateInput = LibraryStateInput.Planned;
}
