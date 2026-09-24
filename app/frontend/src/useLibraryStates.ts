import { useCallback, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { catalogRef, type CatalogCandidate } from './catalog';
import type { LibraryEntry } from './library';
import { useResource } from './useResource';

export function useLibraryStates(items: CatalogCandidate[] | undefined) {
  const auth = useAuth();
  const refs = items?.map(catalogRef).join(',') ?? '';
  const lookup = useResource<LibraryEntry[]>(
    auth.user && refs ? `/library/lookup?refs=${encodeURIComponent(refs)}` : null,
    true,
  );
  const [added, setAdded] = useState<LibraryEntry[]>([]);

  const bySource = useMemo(
    () =>
      new Map(
        [...(lookup.data ?? []), ...added].flatMap((entry) =>
          entry.item.sources.map(
            ({ externalId, key }) => [catalogRef({ externalId, source: key }), entry] as const,
          ),
        ),
      ),
    [added, lookup.data],
  );

  const add = useCallback(
    (entry: LibraryEntry) => setAdded((current) => [...current, entry]),
    [],
  );

  return {
    add,
    entryFor: (item: CatalogCandidate) => bySource.get(catalogRef(item)) ?? null,
    error: lookup.error,
    ready: auth.ready && (!auth.user || !refs || !lookup.loading),
  };
}
