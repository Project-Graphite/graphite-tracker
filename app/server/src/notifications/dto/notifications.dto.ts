import { ArrayUnique, IsArray, IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';
import { CatalogCategory, catalogCategories } from '../../sources/source.types';
import { IsOptionalNotNull } from '../../validation/is-optional-not-null.decorator';

export class UpdateNotificationPreferencesDto {
  @IsOptionalNotNull()
  @IsBoolean()
  enabled?: boolean;

  @IsOptionalNotNull()
  @IsArray()
  @ArrayUnique()
  @IsIn(catalogCategories, { each: true })
  categories?: CatalogCategory[];

  @IsOptionalNotNull()
  @IsIn(['daily', 'weekly'])
  cadence?: 'daily' | 'weekly';
}

export class UnsubscribeDto {
  @IsString()
  @MaxLength(2_000)
  token!: string;
}
