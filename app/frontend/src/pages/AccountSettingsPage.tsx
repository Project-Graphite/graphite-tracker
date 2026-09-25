import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../useResource';
import type { Me } from './SettingsPage';

function Section({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <section>
      <h2 className="m-0 text-xl font-medium">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function run(action: () => Promise<string>, fallback: string) {
    setBusy(true);
    setError('');
    setDone('');
    try {
      setDone(await action());
      return true;
    } catch (reason) {
      setError(errorMessage(reason, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const status = (error || done) && (
    <p className={error ? 'error-message m-0' : 'mono-sm m-0 text-faint'}>{error || done}</p>
  );
  return { busy, run, status };
}

export function AccountSettingsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const me = useResource<Me>('/me', true);
  const email = useAction();
  const password = useAction();
  const timeZone = useAction();
  const data = useAction();
  const removal = useAction();
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function formValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return new FormData(event.currentTarget);
  }

  async function saveTimeZone(value: string) {
    await timeZone.run(async () => {
      const next = await auth.request<Me>('/me', { method: 'PATCH', body: JSON.stringify({ timeZone: value }) });
      me.mutate(() => next);
      return 'Saved.';
    }, 'Could not save the time zone');
  }

  if (me.error) return <p className="error-message">{me.error}</p>;
  if (!me.data) return <p className="text-muted">Loading settings…</p>;
  const current = me.data;
  const zones = [...new Set([current.timeZone, ...Intl.supportedValuesOf('timeZone')])];

  return (
    <div className="grid max-w-3xl gap-12">
      <Section description={`Signed in as ${current.email}. A new address takes effect once you open the link sent to it.`} title="Email">
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            const form = formValues(event);
            const target = event.currentTarget;
            const next = String(form.get('email')).trim();
            void email
              .run(async () => {
                await auth.request('/me/email', {
                  method: 'POST',
                  body: JSON.stringify({ email: next, password: String(form.get('password')) }),
                });
                return `Check ${next} for a confirmation link.`;
              }, 'Could not change the email')
              .then((changed) => changed && target.reset());
          }}
        >
          <label className="field-label">
            New email
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label className="field-label">
            Current password
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <button className="primary-button" disabled={email.busy} type="submit">
              Change email
            </button>
            {email.status}
          </div>
        </form>
      </Section>
      <Section description="Changing it signs out every other device." title="Password">
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            const form = formValues(event);
            const target = event.currentTarget;
            void password
              .run(async () => {
                await auth.changePassword(String(form.get('currentPassword')), String(form.get('newPassword')));
                return 'Password changed.';
              }, 'Could not change the password')
              .then((changed) => changed && target.reset());
          }}
        >
          <label className="field-label">
            Current password
            <input autoComplete="current-password" name="currentPassword" required type="password" />
          </label>
          <label className="field-label">
            New password
            <input autoComplete="new-password" maxLength={128} minLength={12} name="newPassword" required type="password" />
          </label>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <button className="primary-button" disabled={password.busy} type="submit">
              Change password
            </button>
            {password.status}
          </div>
        </form>
      </Section>
      <Section description="Email digests arrive in the morning of this time zone." title="Time zone">
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <label className="field-label min-w-64">
            Time zone
            <select
              disabled={timeZone.busy}
              onChange={(event) => void saveTimeZone(event.target.value)}
              value={current.timeZone}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          {deviceTimeZone && deviceTimeZone !== current.timeZone && (
            <button
              className="secondary-button"
              disabled={timeZone.busy}
              onClick={() => void saveTimeZone(deviceTimeZone)}
              type="button"
            >
              Use {deviceTimeZone.replaceAll('_', ' ')}
            </button>
          )}
          {timeZone.status}
        </div>
      </Section>
      <Section description="Your account, library, progress, ratings, reviews, reports and activity as a JSON file." title="Your data">
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            className="secondary-button"
            disabled={data.busy}
            onClick={() =>
              void data.run(async () => {
                const exported = await auth.request<object>('/me/export');
                const link = document.createElement('a');
                link.href = URL.createObjectURL(
                  new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' }),
                );
                link.download = `graphite-tracker-${current.handle}.json`;
                link.click();
                URL.revokeObjectURL(link.href);
                return 'Downloaded.';
              }, 'Could not export your data')
            }
            type="button"
          >
            Download my data
          </button>
          {data.status}
        </div>
      </Section>
      <Section
        description="Deletes your account, library, ratings, reviews, reports and activity for good. Public reviews disappear from their titles."
        title="Delete account"
      >
        <form
          className="mt-5 flex flex-wrap items-end gap-4"
          onSubmit={(event) => {
            const form = formValues(event);
            if (!window.confirm('Delete your account and everything in it? This cannot be undone.')) return;
            void removal
              .run(async () => {
                await auth.deleteAccount(String(form.get('password')));
                return 'Deleted.';
              }, 'Could not delete the account')
              .then((deleted) => deleted && navigate('/'));
          }}
        >
          <label className="field-label min-w-64">
            Current password
            <input autoComplete="current-password" name="password" required type="password" />
          </label>
          <button className="secondary-button" disabled={removal.busy} type="submit">
            Delete account
          </button>
          {removal.status}
        </form>
      </Section>
    </div>
  );
}
