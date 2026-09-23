import type { CatalogCategory } from './catalog';

export interface SourceSettings {
  sources: Array<{
    key: string;
    displayName: string;
    categories: CatalogCategory[];
    capabilities: string[];
    attribution: string;
    attributionUrl?: string;
    available: boolean;
    enabled: boolean;
  }>;
  global: string | null;
  categories: Partial<Record<CatalogCategory, string>>;
}
