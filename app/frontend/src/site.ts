import type { CatalogCategory } from './catalog';
import { useResource } from './useResource';

export interface SiteSettings {
  adultContentEnabled: boolean;
  defaultSources: Partial<Record<CatalogCategory, string>>;
}

export function useSiteSettings() {
  return useResource<SiteSettings>('/site');
}
