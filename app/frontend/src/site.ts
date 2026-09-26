import { useResource } from './useResource';

export interface SiteSettings {
  adultContentEnabled: boolean;
}

export function useSiteSettings() {
  return useResource<SiteSettings>('/site');
}
