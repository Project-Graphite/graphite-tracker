import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

export class InboxPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  page = 1;
}

export class InboxSummaryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  since?: Date;
}

export class MarkReadDto {
  @IsBoolean()
  read!: boolean;
}
