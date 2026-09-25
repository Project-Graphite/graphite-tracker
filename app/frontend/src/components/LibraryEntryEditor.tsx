import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { categoryLabels } from '../catalog';
import {
  libraryStates,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';
import type { NotificationPreferences } from '../notifications';
import { useResource } from '../useResource';

type EntryUpdate = Record<string, unknown>;

function NumberField({
  label,
  max,
  name,
  onCommit,
  step,
  value,
}: {
  label: string;
  max?: number | null;
  name: string;
  onCommit: (update: EntryUpdate) => void;
  step?: string;
  value: number | null;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        defaultValue={value ?? ''}
        inputMode="decimal"
        key={`${name}:${value}`}
        max={max ?? undefined}
        min="0"
        onBlur={(event) => {
          const next = event.target.value === '' ? null : Number(event.target.value);
          if (next !== value) onCommit({ [name]: next });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        step={step}
        type="number"
      />
    </label>
  );
}

function ProgressFields({
  busy,
  entry,
  onUpdate,
}: {
  busy: boolean;
  entry: LibraryEntry;
  onUpdate: (update: EntryUpdate) => void;
}) {
  const { metadata } = entry.item;
  const units = metadata.capabilities?.progressUnits ?? [];
  const platforms = metadata.platforms ?? [];
  return (
    <>
      {units.includes('season') && (
        <NumberField label="Season" max={metadata.seasonCount} name="progressSeason" onCommit={onUpdate} value={entry.progress.season} />
      )}
      {units.includes('episode') && (
        <NumberField label="Episode" max={metadata.episodeCount} name="progressEpisode" onCommit={onUpdate} value={entry.progress.episode} />
      )}
      {units.includes('chapter') && (
        <NumberField label="Chapter" max={metadata.chapterCount} name="progressChapter" onCommit={onUpdate} step="0.01" value={entry.progress.chapter} />
      )}
      {units.includes('volume') && (
        <NumberField label="Volume" max={metadata.volumeCount} name="progressVolume" onCommit={onUpdate} step="0.01" value={entry.progress.volume} />
      )}
      {units.includes('hours') && (
        <NumberField label="Hours played" name="hoursPlayed" onCommit={onUpdate} step="0.25" value={entry.progress.hours} />
      )}
      {units.includes('percentage') && (
        <NumberField label="Completion %" max={100} name="completionPercentage" onCommit={onUpdate} value={entry.progress.percentage} />
      )}
      {units.includes('hours') && (
        <fieldset className="m-0 border-0 p-0 @sm:col-span-2">
          <legend className="field-label">Platforms you play on</legend>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {platforms.map((platform) => (
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
            {platforms.length === 0 && (
              <span className="text-sm text-faint">No platform data available.</span>
            )}
          </div>
        </fieldset>
      )}
    </>
  );
}

export function LibraryEntryEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: LibraryEntry;
  onChange: (entry: LibraryEntry) => void;
  onRemove: () => void;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unavailableSources = entry.item.sources.filter((source) => !source.active);
  const finished = entry.state === 'completed' || entry.state === 'dropped';
  const needsPlatform =
    entry.item.category === 'game' && entry.progress.platforms.length === 0;
  const preferences = useResource<NotificationPreferences>(
    entry.notificationsEnabled ? '/me/notification-preferences' : null,
    true,
  ).data;
  const emailsOff =
    preferences &&
    (!preferences.enabled ||
      preferences.suspended ||
      !preferences.categories.includes(entry.item.category));

  async function send(run: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError('');
    try {
      await run();
    } catch (reason) {
      setError(errorMessage(reason, fallback));
    } finally {
      setBusy(false);
    }
  }

  const update = (input: EntryUpdate) =>
    void send(async () => {
      onChange(
        await auth.request<LibraryEntry>(`/library/${entry.id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),
      );
    }, 'Could not update this title');

  const removeImportedSource = (referenceId: string) =>
    void send(async () => {
      await auth.request(`/library/${entry.id}/imported-sources/${referenceId}`, {
        method: 'DELETE',
      });
      onChange({
        ...entry,
        importedSources: entry.importedSources.filter((source) => source.id !== referenceId),
      });
    }, 'Could not remove this source');

  const remove = () => {
    if (!window.confirm(`Remove ${entry.item.title} from your library?`)) return;
    void send(async () => {
      await auth.request(`/library/${entry.id}`, { method: 'DELETE' });
      onRemove();
    }, 'Could not remove this title');
  };

  return (
    <div className="@container grid gap-5">
      <div className="grid gap-4 @sm:grid-cols-2">
        <label className="field-label">
          List
          <select
            disabled={busy}
            onChange={(event) => update({ state: event.target.value as LibraryState })}
            value={entry.state}
          >
            {libraryStates.map((state) => (
              <option key={state} value={state}>
                {stateLabel(entry.item.category, state)}
              </option>
            ))}
          </select>
        </label>
        {entry.item.sources.length > 1 && (
          <label className="field-label">
            Preferred source
            <select
              disabled={busy}
              onChange={(event) => update({ preferredSource: event.target.value || null })}
              value={entry.preferredSource ?? ''}
            >
              <option value="">Automatic</option>
              {entry.item.sources.map((source) => (
                <option disabled={!source.active} key={source.key} value={source.key}>
                  {source.active ? source.name : `${source.name} (unavailable)`}
                </option>
              ))}
            </select>
          </label>
        )}
        <ProgressFields busy={busy} entry={entry} onUpdate={update} />
      </div>
      {unavailableSources.length > 0 && (
        <p className="mono-sm m-0 text-faint">
          {unavailableSources.map((source) => source.name).join(', ')} unavailable right now. Your
          list and progress are kept.
        </p>
      )}
      <div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            checked={entry.notificationsEnabled}
            disabled={busy || finished || needsPlatform}
            onChange={(event) => update({ notificationsEnabled: event.target.checked })}
            type="checkbox"
          />
          Release notifications
        </label>
        {(finished || needsPlatform) && (
          <p className="mono-sm mt-1 mb-0 text-faint">
            {finished
              ? 'Available while a title is planned or in progress.'
              : 'Choose a platform first.'}
          </p>
        )}
        {entry.notificationsEnabled && emailsOff && (
          <p className="mono-sm mt-1 mb-0 text-faint">
            Emails for {categoryLabels[entry.item.category].toLowerCase()} are off in{' '}
            <Link className="rule-link" to="/settings/notifications">notification settings</Link>.
          </p>
        )}
      </div>
      {entry.importedSources.length > 0 && (
        <div>
          <p className="field-label m-0">Imported sources</p>
          <ul className="m-0 mt-2 grid gap-2 p-0">
            {entry.importedSources.map((source) => (
              <li className="flex list-none items-baseline justify-between gap-3 text-sm" key={source.id}>
                <span className="min-w-0 text-muted">
                  {source.name} <span className="mono-sm text-faint">· not supported, never checked</span>
                </span>
                <button
                  className="text-button mono-sm"
                  disabled={busy}
                  onClick={() => removeImportedSource(source.id)}
                  type="button"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="error-message m-0">{error}</p>}
      <div className="border-t border-line pt-4">
        <button className="text-button text-sm" disabled={busy} onClick={remove} type="button">
          Remove from library
        </button>
      </div>
    </div>
  );
}
