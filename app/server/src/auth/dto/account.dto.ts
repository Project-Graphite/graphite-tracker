import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

const normalizedEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class EmailDto {
  @IsEmail()
  @Transform(normalizedEmail)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(64, 64)
  token!: string;

  @IsString()
  @Length(12, 128)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @Length(12, 128)
  newPassword!: string;
}

export class ChangeEmailDto extends EmailDto {
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class ConfirmPasswordDto {
  @IsString()
  @MaxLength(128)
  password!: string;
}
