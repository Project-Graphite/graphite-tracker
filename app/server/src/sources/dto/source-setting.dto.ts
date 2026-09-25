import { IsBoolean, IsString, Length } from 'class-validator';

export class SourceSettingDto {
  @IsBoolean()
  enabled!: boolean;
}

export class SourcePreferenceDto {
  @IsString()
  @Length(2, 30)
  source!: string;
}
