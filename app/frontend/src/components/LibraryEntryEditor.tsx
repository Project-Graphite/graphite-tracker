import { useId, useState } from 'react';
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
import { useSnackbar } from '../snackbar';
import { useResource } from '../useResource';
import { ConfirmDialog } from './ConfirmDialog';

type EntryUpdate = Record<string, unknown>;

function progressProblem(text: string, label: string, max: number | null | undefined, decimals: boolean) {
  const value = Number(text);
  if (!/^\d*[.,]?\d*$/.test(text) || Number.isNaN(value)) return `${label} must be a number.`;
  if (!decimals && !Number.isInteger(value)) return `${label} must be a whole number.`;
  if (decimals && Math.round(value * 100) !== value * 100) return `${label} can have up to two decimals.`;
  if (max !== null && max !== undefined && value > max) return `${label} can be at most ${max}.`;
  return '';
}

function NumberField({
  decimals = false,
  label,
  max,
  name,
  onCommit,
  value,
}: {
  decimals?: boolean;
  label: string;
  max?: number | null;
  name: string;
  onCommit: (update: EntryUpdate) => void;
  value: number | null;
}) {
  const id = useId();
  const [error, setError] = useState('');
  return (
    <label className="field-label">
      {label}
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        defaultValue={value ?? ''}
        inputMode={decimals ? 'decimal' : 'numeric'}
        key={`${name}:${value}`}
        onBlur={(event) => {
          const text = event.target.value.trim().replace(',', '.');
          const problem = text === '' ? '' : progressProblem(text, label, max, decimals);
          setError(problem);
          if (problem) return;
          const next = text === '' ? null : Number(text);
          if (next !== value) onCommit({ [name]: next });
        }}
        onInput={() => setError('')}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
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
        <NumberField label="Season" name="progressSeason" onCommit={onUpdate} value={entry.progress.season} />
      )}
      {units.includes('episode') && (
        <NumberField label="Episode" name="progressEpisode" onCommit={onUpdate} value={entry.progress.episode} />
      )}
      {units.includes('chapter') && (
        <NumberField decimals label="Chapter" name="progressChapter" onCommit={onUpdate} value={entry.progress.chapter} />
      )}
      {units.includes('volume') && (
        <NumberField decimals label="Volume" name="progressVolume" onCommit={onUpdate} value={entry.progress.volume} />
      )}
      {units.includes('hours') && (
        <NumberField decimals label="Hours played" name="hoursPlayed" onCommit={onUpdate} value={entry.progress.hours} />
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
  const show = useSnackbar();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const unavailableSources = entry.item.sources.filter((source) => !source.active);
  const unavailablePreferredSource = unavailableSources.find(
    (source) => source.key === entry.preferredSource,
  );
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
            checked={entry.isPrivate}
            disabled={busy}
            onChange={(event) => update({ isPrivate: event.target.checked })}
            type="checkbox"
          />
          Hide from my profile
        </label>
      </div>
      {(entry.item.releasing || entry.notificationsEnabled) && (
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
          {!entry.item.releasing ? (
            <p className="mono-sm mt-1 mb-0 text-faint">
              This title has finished coming out, so there is nothing new to announce.
            </p>
          ) : (
            needsPlatform && (
              <p className="mono-sm mt-1 mb-0 text-faint">
                Choose a platform first.
              </p>
            )
          )}
          {entry.notificationsEnabled && unavailablePreferredSource && (
            <p className="mono-sm mt-1 mb-0 text-faint">
              Paused while {unavailablePreferredSource.name} is unavailable. Choose another preferred
              source or Automatic to get notifications from it instead.
            </p>
          )}
          {entry.notificationsEnabled && emailsOff && (
            <p className="mono-sm mt-1 mb-0 text-faint">
              Emails for {categoryLabels[entry.item.category].toLowerCase()} are off in{' '}
              <Link className="rule-link" to="/settings/notifications">notification settings</Link>.
            </p>
          )}
        </div>
      )}
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
        <button className="text-button text-sm" disabled={busy} onClick={() => setRemoving(true)} type="button">
          Remove from library
        </button>
      </div>
      {removing && (
        <ConfirmDialog
          confirmLabel="Remove"
          eyebrow="Library"
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await auth.request(`/library/${entry.id}`, { method: 'DELETE' });
            show({ message: `${entry.item.title} removed from your library` });
            onRemove();
          }}
          title={`Remove ${entry.item.title}?`}
        >
          <p className="m-0">
            Its list, progress and notification choices go with it. Your rating and review stay on the
            title.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
