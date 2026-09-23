import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import { catalogCategories, categoryLabels, type CatalogCategory } from '../catalog';
import type { SourceSettings } from '../sources';

export function SourcesPage() {
  const auth = useAuth();
  const [settings, setSettings] = useState<SourceSettings>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setSettings(await apiRequest<SourceSettings>('/sources', {}, auth.accessToken));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load sources');
    }
  }, [auth.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function request(path: string, method: 'PATCH' | 'PUT' | 'DELETE', body?: object) {
    if (!auth.accessToken) return;
    setError('');
    try {
      setSettings(
        await apiRequest<SourceSettings>(
          path,
          { method, ...(body ? { body: JSON.stringify(body) } : {}) },
          auth.accessToken,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update sources');
    }
  }

  if (!settings) return <p className="text-muted">Loading sources…</p>;

  return (
    <div className="page-enter">
      <p className="eyebrow">Catalogue connectors</p>
      <h1 className="page-title">Sources</h1>
      <p className="mt-4 max-w-3xl text-muted">
        Choose which approved connectors are available and which one Graphite Tracker prefers. Changing a source never removes library progress.
      </p>
      {error && <p className="error-message mt-5">{error}</p>}
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {settings.sources.map((source) => (
          <article className="rounded-xl border border-line bg-surface p-5" key={source.key}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-lg font-medium">{source.displayName}</h2>
                <p className="mono-sm mt-1 text-faint">{source.key}</p>
              </div>
              <input
                aria-label={`Enable ${source.displayName}`}
                checked={source.enabled}
                disabled={!source.available}
                onChange={(event) => void request(`/sources/${source.key}`, 'PATCH', { enabled: event.target.checked })}
                type="checkbox"
              />
            </div>
            <p className="mt-4 text-sm text-muted">
              {source.attributionUrl ? (
                <a className="rule-link" href={source.attributionUrl} rel="noreferrer" target="_blank">
                  {source.attribution}
                </a>
              ) : (
                source.attribution
              )}
            </p>
            {!source.available && (
              <p className="mt-3 text-sm text-faint">Not configured on this server.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {source.categories.map((category) => <span className="rounded-full border border-line px-2 py-1 text-xs text-faint" key={category}>{categoryLabels[category]}</span>)}
            </div>
            <p className="mono-sm mt-4 text-faint">{source.capabilities.join(' · ')}</p>
          </article>
        ))}
      </section>
      <section className="mt-10 max-w-3xl rounded-xl border border-line bg-surface p-5">
        <h2 className="m-0 text-xl font-medium">Preferences</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="field-label sm:col-span-2">
            Global default
            <select
              value={settings.global ?? ''}
              onChange={(event) =>
                void request(
                  '/sources/preferences/global',
                  event.target.value ? 'PUT' : 'DELETE',
                  event.target.value ? { source: event.target.value } : undefined,
                )
              }
            >
              <option value="">System default</option>
              {settings.sources.filter((source) => source.enabled).map((source) => <option key={source.key} value={source.key}>{source.displayName}</option>)}
            </select>
          </label>
          {catalogCategories.map((category) => (
            <label className="field-label" key={category}>
              {categoryLabels[category]}
              <select
                value={settings.categories[category] ?? ''}
                onChange={(event) =>
                  void request(
                    `/sources/preferences/category/${category}`,
                    event.target.value ? 'PUT' : 'DELETE',
                    event.target.value ? { source: event.target.value } : undefined,
                  )
                }
              >
                <option value="">Use global default</option>
                {settings.sources
                  .filter((source) => source.enabled && source.categories.includes(category as CatalogCategory))
                  .map((source) => <option key={source.key} value={source.key}>{source.displayName}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
