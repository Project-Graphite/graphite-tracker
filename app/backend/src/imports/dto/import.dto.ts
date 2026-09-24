import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ImportConflictPolicy, ImportDecision, ImportMatch } from '@prisma/client';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class ListCandidatesDto {
  @Transform(upper)
  @IsEnum(ImportMatch)
  match!: ImportMatch;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  page = 1;
}

export class DecideCandidateDto {
  @Transform(upper)
  @IsEnum(ImportDecision)
  decision!: ImportDecision;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  choice?: number;
}

export class ApplyImportDto {
  @Transform(upper)
  @IsEnum(ImportConflictPolicy)
  conflictPolicy: ImportConflictPolicy = ImportConflictPolicy.ADD_MISSING;
}
