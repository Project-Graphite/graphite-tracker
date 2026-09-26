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
import { ReportReason } from '@prisma/client';

const trimmedOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class SaveReviewDto {
  @IsOptional()
  @IsInt({ message: 'Ratings go from 1 to 10.' })
  @Min(1, { message: 'Ratings go from 1 to 10.' })
  @Max(10, { message: 'Ratings go from 1 to 10.' })
  rating?: number | null;

  @IsOptional()
  @Transform(trimmedOrNull)
  @IsString()
  @MaxLength(200, { message: 'Review titles are at most 200 characters long.' })
  title?: string | null;

  @IsOptional()
  @Transform(trimmedOrNull)
  @IsString()
  @MaxLength(10_000, { message: 'Reviews are at most 10,000 characters long.' })
  body?: string | null;

  @IsBoolean()
  containsSpoilers = false;

  @IsIn(['public', 'private'])
  visibility!: 'public' | 'private';
}

export class ReportReviewDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ReportReason)
  reason!: ReportReason;
}

export class ListReviewsDto {
  @IsString()
  @Length(2, 30)
  source!: string;

  @IsString()
  @Length(1, 100)
  externalId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  page = 1;
}
