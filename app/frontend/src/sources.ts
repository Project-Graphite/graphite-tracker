import type { CatalogCategory } from './catalog';

export interface SourceSettings {
  sources: Array<{
    key: string;
    displayName: string;
    categories: CatalogCategory[];
    languages: string[];
    capabilities: string[];
    attribution: string;
    enabled: boolean;
  }>;
  global: string | null;
  categories: Partial<Record<CatalogCategory, string>>;
}
