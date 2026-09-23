import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest, isAbortError } from '../api';
import { useAuth } from '../auth';
import { catalogCategories, categoryLabels } from '../catalog';
import {
  entryHref,
  libraryStateLabels,
  libraryStates,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';

export function LibraryPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState('');
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';

  useEffect(() => {
    if (!auth.accessToken) return;
    const controller = new AbortController();
    const parameters = new URLSearchParams();
    for (const key of ['category', 'state', 'query', 'sort']) {
      const value = searchParams.get(key);
      if (value) parameters.set(key, value);
    }
    setLoading(true);
    setError('');
    void apiRequest<LibraryEntry[]>(
      `/library?${parameters.toString()}`,
      { signal: controller.signal },
      auth.accessToken,
    )
      .then(setEntries)
      .catch((reason: unknown) => {
        if (!isAbortError(reason)) {
          setError(reason instanceof Error ? reason.message : 'Could not load library');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [auth.accessToken, searchParams]);

  async function update(id: string, input: Record<string, unknown>) {
    if (!auth.accessToken) return;
    setPendingId(id);
    setError('');
    try {
      const updated = await apiRequest<LibraryEntry>(
        `/library/${id}`,
        { method: 'PATCH', body: JSON.stringify(input) },
        auth.accessToken,
      );
      setEntries((current) =>
        current.map((entry) => (entry.id === id ? updated : entry)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update entry');
    } finally {
      setPendingId('');
    }
  }

  async function remove(entry: LibraryEntry) {
    if (
      !auth.accessToken ||
      !window.confirm(`Remove ${entry.item.title} from your library?`)
    ) {
      return;
    }
    try {
      await apiRequest(
        `/library/${entry.id}`,
        { method: 'DELETE' },
        auth.accessToken,
      );
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove entry');
    }
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parameters = new URLSearchParams({ view });
    for (const key of ['category', 'state', 'query', 'sort']) {
      const value = String(form.get(key)).trim();
      if (value) parameters.set(key, value);
    }
    navigate(`/library?${parameters.toString()}`);
  }

  function setView(nextView: 'grid' | 'list') {
    const parameters = new URLSearchParams(searchParams);
    parameters.set('view', nextView);
    navigate(`/library?${parameters.toString()}`);
  }

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your collection</p>
          <h1 className="page-title">Library</h1>
        </div>
        <div className="flex gap-2">
          <button className="secondary-button" disabled={view === 'grid'} onClick={() => setView('grid')} type="button">Grid</button>
          <button className="secondary-button" disabled={view === 'list'} onClick={() => setView('list')} type="button">List</button>
        </div>
      </div>
      <form className="mt-7 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5" key={searchParams.toString()} onSubmit={apply}>
        <label className="field-label">
          Search
          <input defaultValue={searchParams.get('query') ?? ''} name="query" placeholder="Title" />
        </label>
        <label className="field-label">
          Category
          <select defaultValue={searchParams.get('category') ?? ''} name="category">
            <option value="">All categories</option>
            {catalogCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
          </select>
        </label>
        <label className="field-label">
          State
          <select defaultValue={searchParams.get('state') ?? ''} name="state">
            <option value="">All states</option>
            {Object.entries(libraryStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field-label">
          Sort
          <select defaultValue={searchParams.get('sort') ?? 'updated'} name="sort">
            <option value="updated">Recently updated</option>
            <option value="title">Title</option>
            <option value="release">Release date</option>
          </select>
        </label>
        <button className="primary-button self-end" type="submit">Apply</button>
      </form>
      {error && <p className="error-message mt-5">{error}</p>}
      {loading ? (
        <p className="mt-8 text-muted">Loading your library…</p>
      ) : entries.length === 0 ? (
        <div className="mt-9 rounded-xl border border-dashed border-line p-8 text-center">
          <h2 className="m-0 text-xl font-medium">Nothing matches.</h2>
          <p className="mt-2 text-muted">Discover a title and add it to your library.</p>
          <Link className="primary-button mt-5 inline-flex" to="/discover/movie/recent">Discover titles</Link>
        </div>
      ) : (
        <div className={view === 'grid' ? 'mt-9 grid gap-5 md:grid-cols-2' : 'mt-9 grid gap-4'}>
          {entries.map((entry) => (
            <LibraryCard
              busy={pendingId === entry.id}
              entry={entry}
              key={entry.id}
              onRemove={() => void remove(entry)}
              onUpdate={(input) => void update(entry.id, input)}
              view={view}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  busy,
  entry,
  onRemove,
  onUpdate,
  view,
}: {
  busy: boolean;
  entry: LibraryEntry;
  onRemove: () => void;
  onUpdate: (input: Record<string, unknown>) => void;
  view: 'grid' | 'list';
}) {
  const rawgSource = entry.item.sources.find((item) => item.key === 'rawg');
  const activeSources = entry.item.sources.filter((item) => item.active);
  const href = entryHref(entry);
  return (
    <article className={`grid gap-4 rounded-xl border border-line bg-surface p-4 ${view === 'list' ? 'grid-cols-[5rem_1fr] sm:grid-cols-[6rem_1fr]' : 'grid-cols-[5rem_1fr]'}`}>
      <div className="aspect-[2/3] overflow-hidden rounded-md bg-line-soft">
        {entry.item.posterUrl && <img className="h-full w-full object-cover" src={entry.item.posterUrl} alt={`Poster for ${entry.item.title}`} />}
      </div>
      <div className="min-w-0">
        <p className="mono-sm m-0 text-faint">{categoryLabels[entry.item.category]} · {entry.item.releaseDate?.slice(0, 4) ?? 'Date unknown'}</p>
        <h2 className="mt-1 mb-0 text-lg font-medium">
          {href ? <Link className="text-ink no-underline hover:underline" to={href}>{entry.item.title}</Link> : entry.item.title}
        </h2>
        {rawgSource && (
          <a
            className="mono-sm rule-link mt-2 inline-block"
            href={rawgSource.url ?? 'https://rawg.io/'}
            rel="noreferrer"
            target="_blank"
          >
            Data provided by RAWG
          </a>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            List
            <select value={entry.state} onChange={(event) => onUpdate({ state: event.target.value as LibraryState })}>
              {libraryStates.map((state) => <option key={state} value={state}>{stateLabel(entry.item.category, state)}</option>)}
            </select>
          </label>
          {activeSources.length > 1 && (
            <label className="field-label">
              Preferred source
              <select value={entry.preferredSource ?? ''} onChange={(event) => onUpdate({ preferredSource: event.target.value || null })}>
                <option value="">Automatic</option>
                {activeSources.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
              </select>
            </label>
          )}
          <ProgressFields busy={busy} entry={entry} onUpdate={onUpdate} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              checked={entry.notificationsEnabled}
              disabled={
                entry.state === 'completed' ||
                entry.state === 'dropped' ||
                (entry.item.category === 'game' && entry.progress.platforms.length === 0)
              }
              onChange={(event) => onUpdate({ notificationsEnabled: event.target.checked })}
              type="checkbox"
            />
            Release notifications
          </label>
          <button className="text-button text-sm" onClick={onRemove} type="button">Remove</button>
        </div>
      </div>
    </article>
  );
}

function ProgressFields({
  busy,
  entry,
  onUpdate,
}: {
  busy: boolean;
  entry: LibraryEntry;
  onUpdate: (input: Record<string, unknown>) => void;
}) {
  const numberField = (
    label: string,
    key: string,
    value: number | null,
    options: { max?: number; step?: string },
  ) => (
    <label className="field-label" key={key}>
      {label}
      <input
        defaultValue={value ?? ''}
        key={`${entry.id}:${key}:${value}`}
        max={options.max}
        min="0"
        onBlur={(event) => {
          const next = event.target.value === '' ? null : Number(event.target.value);
          if (next !== value) onUpdate({ [key]: next });
        }}
        step={options.step}
        type="number"
      />
    </label>
  );
  const progressUnits = entry.item.metadata.capabilities?.progressUnits ?? [];
  if (progressUnits.includes('season') || progressUnits.includes('episode')) {
    return (
      <>
        {progressUnits.includes('season') &&
          numberField('Season', 'progressSeason', entry.progress.season, {
            max: entry.item.metadata.seasonCount ?? undefined,
          })}
        {progressUnits.includes('episode') &&
          numberField('Episode', 'progressEpisode', entry.progress.episode, {
            max: entry.item.metadata.episodeCount ?? undefined,
          })}
      </>
    );
  }
  if (progressUnits.includes('chapter') || progressUnits.includes('volume')) {
    return (
      <>
        {progressUnits.includes('chapter') &&
          numberField('Chapter', 'progressChapter', entry.progress.chapter, {
            max: entry.item.metadata.chapterCount ?? undefined,
            step: '0.01',
          })}
        {progressUnits.includes('volume') &&
          numberField('Volume', 'progressVolume', entry.progress.volume, {
            max: entry.item.metadata.volumeCount ?? undefined,
            step: '0.01',
          })}
      </>
    );
  }
  if (progressUnits.includes('hours') || progressUnits.includes('percentage')) {
    const availablePlatforms = entry.item.metadata.platforms ?? [];
    return (
      <>
        {numberField('Hours played', 'hoursPlayed', entry.progress.hours, { step: '0.25' })}
        {numberField('Completion %', 'completionPercentage', entry.progress.percentage, { max: 100 })}
        <fieldset className="sm:col-span-2">
          <legend className="field-label">Selected platforms</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {availablePlatforms.map((platform) => (
              <label className="flex items-center gap-2 text-sm text-muted" key={platform}>
                <input
                  checked={entry.progress.platforms.includes(platform)}
                  disabled={busy}
                  onChange={(event) =>
                    onUpdate({
                      platforms: event.target.checked
                        ? [...entry.progress.platforms, platform]
                        : entry.progress.platforms.filter((item) => item !== platform),
                    })
                  }
                  type="checkbox"
                />
                {platform}
              </label>
            ))}
            {availablePlatforms.length === 0 && <span className="text-sm text-faint">No platform data available.</span>}
          </div>
        </fieldset>
      </>
    );
  }
  return null;
}
