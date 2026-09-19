import { IsEnum } from 'class-validator';
import { LibraryStateInput } from './create-library-entry.dto';

export class UpdateLibraryEntryDto {
  @IsEnum(LibraryStateInput)
  state!: LibraryStateInput;
}
