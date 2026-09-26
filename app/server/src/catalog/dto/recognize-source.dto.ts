import { IsUrl } from 'class-validator';

export class RecognizeSourceDto {
  @IsUrl({ require_protocol: true }, { message: 'Paste a full link, starting with https://' })
  url!: string;
}
