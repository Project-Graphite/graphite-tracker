import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReportResolution } from '@prisma/client';

export class AdminPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;
}

export class ListReportsDto extends AdminPageDto {
  @IsIn(['open', 'resolved'])
  status: 'open' | 'resolved' = 'open';
}

export class ListReviewsDto extends AdminPageDto {
  @IsIn(['public', 'private', 'hidden'])
  status: 'public' | 'private' | 'hidden' = 'public';
}

export class ListUsersDto extends AdminPageDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  query?: string;
}

export class ResolveReportDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ReportResolution)
  resolution!: ReportResolution;
}

export class SetReviewHiddenDto {
  @IsBoolean()
  hidden!: boolean;
}

export class SetUserActiveDto {
  @IsBoolean()
  active!: boolean;
}

export class UpdateSiteSettingsDto {
  @IsBoolean()
  adultContentEnabled!: boolean;

  @IsString()
  @MaxLength(128)
  password!: string;
}

export class SetUserRoleDto {
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';

  @IsString()
  @MaxLength(128)
  password!: string;
}
