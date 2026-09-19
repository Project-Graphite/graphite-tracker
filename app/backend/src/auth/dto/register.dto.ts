import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/)
  @Transform(({ value }) => String(value).trim().toLowerCase())
  handle!: string;

  @IsString()
  @Length(1, 80)
  @Transform(({ value }) => String(value).trim())
  displayName!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}
