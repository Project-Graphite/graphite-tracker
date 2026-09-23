import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';
import { useAuth } from './auth';
import type { CatalogCategory } from './catalog';
import type { LibraryEntry } from './library';

export function librarySourceKey(source: string, externalId: string) {
  return `${source}:${externalId}`;
}

export function useLibraryEntries(category?: CatalogCategory) {
  const auth = useAuth();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!auth.accessToken) {
      setEntries([]);
      setReady(auth.ready);
      setError('');
      return;
    }
    const controller = new AbortController();
    const parameters = category ? `?category=${category}` : '';
    setReady(false);
    setError('');
    void apiRequest<LibraryEntry[]>(
      `/library${parameters}`,
      { signal: controller.signal },
      auth.accessToken,
    )
      .then(setEntries)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          setError(reason instanceof Error ? reason.message : 'Could not load library state');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [auth.accessToken, auth.ready, category]);

  const bySource = useMemo(
    () =>
      new Map(
        entries.flatMap((entry) =>
          entry.item.sources.map((source) => [
            librarySourceKey(source.key, source.externalId),
            entry,
          ] as const),
        ),
      ),
    [entries],
  );

  const upsert = useCallback((entry: LibraryEntry) => {
    setEntries((current) => [
      entry,
      ...current.filter((candidate) => candidate.id !== entry.id),
    ]);
  }, []);

  return { bySource, entries, error, ready, upsert };
}
