import type { CatalogCategory } from './catalog';

export interface NotificationPreferences {
  enabled: boolean;
  categories: CatalogCategory[];
  cadence: 'daily' | 'weekly';
  suspended: boolean;
}
