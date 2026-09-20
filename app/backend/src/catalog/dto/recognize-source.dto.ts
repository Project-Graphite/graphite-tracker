import { IsUrl } from 'class-validator';

export class RecognizeSourceDto {
  @IsUrl({ require_protocol: true })
  url!: string;
}
