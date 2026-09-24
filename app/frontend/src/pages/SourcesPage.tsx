import { useState } from 'react';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { catalogCategories, categoryLabels } from '../catalog';
import type { SourceSettings } from '../sources';
import { useResource } from '../useResource';

export function SourcesPage() {
  const auth = useAuth();
  const settings = useResource<SourceSettings>('/sources', true);
  const [error, setError] = useState('');

  async function change(path: string, method: 'PATCH' | 'PUT' | 'DELETE', body?: object) {
    setError('');
    try {
      const next = await auth.request<SourceSettings>(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      settings.mutate(() => next);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not update sources'));
    }
  }

  const choose = (path: string, source: string) =>
    void change(path, source ? 'PUT' : 'DELETE', source ? { source } : undefined);

  if (!settings.data) {
    return settings.error ? (
      <p className="error-message">{settings.error}</p>
    ) : (
      <p className="text-muted">Loading sources…</p>
    );
  }
  const { data } = settings;

  return (
    <div className="page-enter">
      <p className="eyebrow">Catalogue connectors</p>
      <h1 className="page-title">Sources</h1>
      <p className="mt-4 max-w-3xl text-muted">
        Choose which approved connectors you use and which one to prefer. Changing a source never
        removes library progress.
      </p>
      {error && <p className="error-message mt-5">{error}</p>}
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.sources.map((source) => (
          <article className="rounded-xl border border-line bg-surface p-5" key={source.key}>
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-lg font-medium">{source.displayName}</span>
                <span className="mono-sm text-faint">
                  {source.available ? (source.enabled ? 'enabled' : 'disabled') : 'not configured on this server'}
                </span>
              </span>
              <input
                checked={source.enabled}
                disabled={!source.available}
                onChange={(event) =>
                  void change(`/sources/${source.key}`, 'PATCH', { enabled: event.target.checked })
                }
                type="checkbox"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {source.categories.map((category) => (
                <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted" key={category}>
                  {categoryLabels[category]}
                </span>
              ))}
            </div>
            <p className="mt-4 mb-0 text-sm text-muted">
              {source.attributionUrl ? (
                <a className="rule-link" href={source.attributionUrl} rel="noreferrer" target="_blank">
                  {source.attribution}
                </a>
              ) : (
                source.attribution
              )}
            </p>
          </article>
        ))}
      </section>
      <section className="mt-10 max-w-3xl">
        <h2 className="m-0 text-xl font-medium">Preferred sources</h2>
        <p className="mt-2 text-sm text-muted">
          A title's own preference wins, then its category, then the global default.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="field-label sm:col-span-2">
            Global default
            <select
              onChange={(event) => choose('/sources/preferences/global', event.target.value)}
              value={data.global ?? ''}
            >
              <option value="">System default</option>
              {data.sources
                .filter((source) => source.enabled)
                .map((source) => (
                  <option key={source.key} value={source.key}>{source.displayName}</option>
                ))}
            </select>
          </label>
          {catalogCategories.map((category) => (
            <label className="field-label" key={category}>
              {categoryLabels[category]}
              <select
                onChange={(event) => choose(`/sources/preferences/category/${category}`, event.target.value)}
                value={data.categories[category] ?? ''}
              >
                <option value="">Use global default</option>
                {data.sources
                  .filter((source) => source.enabled && source.categories.includes(category))
                  .map((source) => (
                    <option key={source.key} value={source.key}>{source.displayName}</option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
