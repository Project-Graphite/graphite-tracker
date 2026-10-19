import Alert from '@mui/material/Alert';
import FormLabel from '@mui/material/FormLabel';
import MuiLink from '@mui/material/Link';
import { useState } from 'react';
import { Link } from 'react-router';
import { Checkbox, errorMessage, FormSkeleton, Radio } from '@project-graphite/ui';
import { useAuth } from '../auth';
import { catalogCategories, categoryLabels } from '../catalog';
import type { NotificationPreferences } from '../notifications';
import { useResource } from '../useResource';

export function NotificationSettingsPage() {
  const auth = useAuth();
  const preferences = useResource<NotificationPreferences>('/me/notification-preferences', true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(change: Partial<Omit<NotificationPreferences, 'suspended'>>) {
    setBusy(true);
    setError('');
    try {
      const next = await auth.request<NotificationPreferences>('/me/notification-preferences', {
        method: 'PATCH',
        body: JSON.stringify(change),
      });
      preferences.mutate(() => next);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save your notification settings'));
    } finally {
      setBusy(false);
    }
  }

  if (preferences.error) return <Alert severity="error">{preferences.error}</Alert>;
  if (!preferences.data) return <FormSkeleton fields={1} />;
  const { cadence, categories, enabled, suspended } = preferences.data;

  return (
    <div className="fade-in grid max-w-3xl gap-12">
      {error && <Alert severity="error">{error}</Alert>}
      {suspended && (
        <Alert severity="info">
          Emails stopped after the mail server rejected several digests to your address. Check the
          address in <MuiLink component={Link} to="/settings/account" underline="always">account settings</MuiLink>, then
          turn emails back on.
        </Alert>
      )}
      <section>
        <h2 className="m-0 text-xl font-medium">Release emails</h2>
        <p className="mt-2 text-sm text-muted">
          Titles you turn release notifications on for in your library always appear in your{' '}
          <MuiLink component={Link} to="/notifications" underline="always">notifications</MuiLink>, with a pop-up while you
          are browsing. Emails are extra and optional.
        </p>
        <p className="mt-2 text-sm text-muted">
          One email collects new episodes, chapters and releases for the titles you turn
          notifications on for in your library, while they are planned or in progress. Digests arrive
          after 08:00 in the <MuiLink component={Link} to="/settings/account" underline="always">time zone</MuiLink> you
          chose.
        </p>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <Checkbox
            checked={enabled && !suspended}
            className="mt-1"
            disabled={busy}
            onChange={(event) => void save({ enabled: event.target.checked })}
          />
          <span>
            <span className="block font-medium">Email me about new releases</span>
            <span className="text-sm text-muted">Off until you turn it on. Every email has a one-click unsubscribe link.</span>
          </span>
        </label>
        <fieldset className="m-0 mt-5 grid gap-2 border-0 p-0" disabled={busy || !enabled || suspended}>
          <FormLabel className="mb-2" component="legend">How often</FormLabel>
          {(
            [
              ['daily', 'Daily digest'],
              ['weekly', 'Weekly digest, on Mondays'],
            ] as const
          ).map(([value, label]) => (
            <Radio
              checked={cadence === value}
              className={`gap-2 text-sm text-muted ${enabled && !suspended ? '' : 'opacity-55'}`}
              key={value}
              label={label}
              name="cadence"
              onChange={() => void save({ cadence: value })}
            />
          ))}
        </fieldset>
        <fieldset className="m-0 mt-5 grid gap-2 border-0 p-0 sm:grid-cols-3" disabled={busy || !enabled || suspended}>
          <FormLabel className="mb-2" component="legend">Categories</FormLabel>
          {catalogCategories.map((category) => (
            <Checkbox
              checked={categories.includes(category)}
              className={`gap-2 text-sm text-muted ${enabled && !suspended ? '' : 'opacity-55'}`}
              key={category}
              label={categoryLabels[category]}
              onChange={(event) =>
                void save({
                  categories: event.target.checked
                    ? [...categories, category]
                    : categories.filter((item) => item !== category),
                })
              }
            />
          ))}
        </fieldset>
      </section>
    </div>
  );
}
