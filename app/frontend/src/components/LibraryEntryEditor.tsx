import Alert from '@mui/material/Alert';
import FormLabel from '@mui/material/FormLabel';
import MuiLink from '@mui/material/Link';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Checkbox, ConfirmDialog, errorMessage, Select, TextField, useSnackbar } from '@project-graphite/ui';
import { useAuth } from '../auth';
import { categoryLabels } from '../catalog';
import {
  libraryStates,
  stateLabel,
  type LibraryEntry,
} from '../library';
import type { NotificationPreferences } from '../notifications';
import { useResource } from '../useResource';

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
  const [error, setError] = useState('');
  return (
    <TextField
      defaultValue={value ?? ''}
      error={error}
      inputMode={decimals ? 'decimal' : 'numeric'}
      key={`${name}:${value}`}
      label={label}
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
          <FormLabel component="legend">Platforms you play on</FormLabel>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {platforms.map((platform) => (
              <Checkbox
                checked={entry.progress.platforms.includes(platform)}
                disabled={busy}
                key={platform}
                label={platform}
                onChange={(event) =>
                  onUpdate({
                    platforms: event.target.checked
                      ? [...entry.progress.platforms, platform]
                      : entry.progress.platforms.filter((item) => item !== platform),
                  })
                }
              />
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
        <Select
          disabled={busy}
          label="List"
          onChange={(state) => update({ state })}
          options={libraryStates.map((state) => ({ value: state, label: stateLabel(entry.item.category, state) }))}
          value={entry.state}
        />
        {entry.item.sources.length > 1 && (
          <Select
            disabled={busy}
            label="Preferred source"
            onChange={(value) => update({ preferredSource: value || null })}
            options={[
              { value: '', label: 'Automatic' },
              ...entry.item.sources.map((source) => ({
                disabled: !source.active,
                value: source.key,
                label: source.active ? source.name : `${source.name} (unavailable)`,
              })),
            ]}
            value={entry.preferredSource ?? ''}
          />
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
        <Checkbox
          checked={entry.isPrivate}
          disabled={busy}
          label="Hide from my profile"
          onChange={(event) => update({ isPrivate: event.target.checked })}
        />
      </div>
      {(entry.item.releasing || entry.notificationsEnabled) && (
        <div>
          <Checkbox
            checked={entry.notificationsEnabled}
            disabled={busy || finished || needsPlatform}
            label="Release notifications"
            onChange={(event) => update({ notificationsEnabled: event.target.checked })}
          />
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
              <MuiLink component={Link} to="/settings/notifications" underline="always">notification settings</MuiLink>.
            </p>
          )}
        </div>
      )}
      {entry.importedSources.length > 0 && (
        <div>
          <FormLabel component="p">Imported sources</FormLabel>
          <ul className="m-0 mt-2 grid gap-2 p-0">
            {entry.importedSources.map((source) => (
              <li className="flex list-none items-baseline justify-between gap-3 text-sm" key={source.id}>
                <span className="min-w-0 text-muted">
                  {source.name} <span className="mono-sm text-faint">· not supported, never checked</span>
                </span>
                <Button
                  className="mono-sm"
                  disabled={busy}
                  onClick={() => removeImportedSource(source.id)}
                  size="small"
                  variant="text"
                >
                  remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      <div className="border-t border-line pt-4">
        <Button disabled={busy} onClick={() => setRemoving(true)} size="small" variant="text">
          Remove from library
        </Button>
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
