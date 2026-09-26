import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { catalogCategories, categoryLabels } from '../catalog';
import { FormSkeleton } from '../components/Skeleton';
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

  if (preferences.error) return <p className="error-message">{preferences.error}</p>;
  if (!preferences.data) return <FormSkeleton fields={1} />;
  const { cadence, categories, enabled, suspended } = preferences.data;

  return (
    <div className="fade-in grid max-w-3xl gap-12">
      {error && <p className="error-message m-0">{error}</p>}
      {suspended && (
        <p className="notice m-0">
          Emails stopped after the mail server rejected several digests to your address. Check the
          address in <Link className="rule-link" to="/settings/account">account settings</Link>, then
          turn emails back on.
        </p>
      )}
      <section>
        <h2 className="m-0 text-xl font-medium">Release emails</h2>
        <p className="mt-2 text-sm text-muted">
          One email collects new episodes, chapters and releases for the titles you turn
          notifications on for in your library, while they are planned or in progress. Digests arrive
          after 08:00 in the <Link className="rule-link" to="/settings/account">time zone</Link> you
          chose.
        </p>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <input
            checked={enabled && !suspended}
            className="mt-1"
            disabled={busy}
            onChange={(event) => void save({ enabled: event.target.checked })}
            type="checkbox"
          />
          <span>
            <span className="block font-medium">Email me about new releases</span>
            <span className="text-sm text-muted">Off until you turn it on. Every email has a one-click unsubscribe link.</span>
          </span>
        </label>
        <fieldset className="m-0 mt-5 grid gap-2 border-0 p-0" disabled={busy || !enabled || suspended}>
          <legend className="field-label mb-2">How often</legend>
          {(
            [
              ['daily', 'Daily digest'],
              ['weekly', 'Weekly digest, on Mondays'],
            ] as const
          ).map(([value, label]) => (
            <label className={`flex items-center gap-2 text-sm text-muted ${enabled && !suspended ? '' : 'opacity-55'}`} key={value}>
              <input checked={cadence === value} name="cadence" onChange={() => void save({ cadence: value })} type="radio" />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="m-0 mt-5 grid gap-2 border-0 p-0 sm:grid-cols-3" disabled={busy || !enabled || suspended}>
          <legend className="field-label mb-2">Categories</legend>
          {catalogCategories.map((category) => (
            <label className={`flex items-center gap-2 text-sm text-muted ${enabled && !suspended ? '' : 'opacity-55'}`} key={category}>
              <input
                checked={categories.includes(category)}
                onChange={(event) =>
                  void save({
                    categories: event.target.checked
                      ? [...categories, category]
                      : categories.filter((item) => item !== category),
                  })
                }
                type="checkbox"
              />
              {categoryLabels[category]}
            </label>
          ))}
        </fieldset>
      </section>
    </div>
  );
}
