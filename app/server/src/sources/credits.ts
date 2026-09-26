import { CatalogCredit } from './source.types';

export function creditGroups(groups: Array<[string, Array<string | undefined>]>): CatalogCredit[] {
  return groups.flatMap(([role, names]) => {
    const unique = [...new Set(names.filter((name): name is string => Boolean(name)))];
    return unique.length > 0 ? [{ role, names: unique.slice(0, 8) }] : [];
  });
}
