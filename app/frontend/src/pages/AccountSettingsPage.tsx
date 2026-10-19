import Alert from '@mui/material/Alert';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button, ConfirmDialog, errorMessage, FormSkeleton, Select, TextField } from '@project-graphite/ui';
import { useAuth } from '../auth';
import { useResource } from '../useResource';
import { emailAddress, password as newPassword, required, useFormErrors } from '../validation';
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

  const status = error ? <Alert severity="error">{error}</Alert> : done && <p className="mono-sm m-0 text-faint">{done}</p>;
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
  const emailForm = useFormErrors();
  const passwordForm = useFormErrors();
  const removalForm = useFormErrors();
  const [removingWith, setRemovingWith] = useState<string>();
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;


  async function saveTimeZone(value: string) {
    await timeZone.run(async () => {
      const next = await auth.request<Me>('/me', { method: 'PATCH', body: JSON.stringify({ timeZone: value }) });
      me.mutate(() => next);
      return 'Saved.';
    }, 'Could not save the time zone');
  }

  if (me.error) return <Alert severity="error">{me.error}</Alert>;
  if (!me.data) return <FormSkeleton fields={2} />;
  const current = me.data;
  const zones = [...new Set([current.timeZone, ...Intl.supportedValuesOf('timeZone')])];

  return (
    <div className="fade-in grid max-w-3xl gap-12">
      <Section description={`Signed in as ${current.email}. A new address takes effect once you open the link sent to it.`} title="Email">
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const target = event.currentTarget;
            if (
              !emailForm.check(target, {
                email: [required('Enter the new email address.'), emailAddress],
                password: [required('Enter your current password.')],
              })
            ) {
              return;
            }
            const form = new FormData(target);
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
          <TextField
            autoComplete="email"
            inputMode="email"
            label="New email"
            type="email"
            {...emailForm.field('email')}
          />
          <TextField
            autoComplete="current-password"
            label="Current password"
            type="password"
            {...emailForm.field('password')}
          />
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <Button disabled={email.busy} type="submit" variant="primary">
              Change email
            </Button>
            {email.status}
          </div>
        </form>
      </Section>
      <Section description="Changing it signs out every other device." title="Password">
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const target = event.currentTarget;
            if (
              !passwordForm.check(target, {
                currentPassword: [required('Enter your current password.')],
                newPassword,
              })
            ) {
              return;
            }
            const form = new FormData(target);
            void password
              .run(async () => {
                await auth.changePassword(String(form.get('currentPassword')), String(form.get('newPassword')));
                return 'Password changed.';
              }, 'Could not change the password')
              .then((changed) => changed && target.reset());
          }}
        >
          <TextField
            autoComplete="current-password"
            label="Current password"
            type="password"
            {...passwordForm.field('currentPassword')}
          />
          <TextField
            autoComplete="new-password"
            hint="At least 12 characters."
            label="New password"
            type="password"
            {...passwordForm.field('newPassword')}
          />
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <Button disabled={password.busy} type="submit" variant="primary">
              Change password
            </Button>
            {password.status}
          </div>
        </form>
      </Section>
      <Section description="Email digests arrive in the morning of this time zone." title="Time zone">
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <Select
            aria-label="Time zone"
            className="min-w-64"
            disabled={timeZone.busy}
            fullWidth
            onChange={(value) => void saveTimeZone(value)}
            options={zones.map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }))}
            value={current.timeZone}
          />
          {deviceTimeZone && deviceTimeZone !== current.timeZone && (
            <Button disabled={timeZone.busy} onClick={() => void saveTimeZone(deviceTimeZone)}>
              Use {deviceTimeZone.replaceAll('_', ' ')}
            </Button>
          )}
          {timeZone.status}
        </div>
      </Section>
      <Section description="Your account, library, progress, ratings, reviews, reports and activity as a JSON file." title="Your data">
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Button
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
          >
            Download my data
          </Button>
          {data.status}
        </div>
      </Section>
      <Section
        description="Deletes your account, library, ratings, reviews, reports and activity for good. Public reviews disappear from their titles."
        title="Delete account"
      >
        <form
          className="mt-5 flex flex-wrap items-start gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const target = event.currentTarget;
            if (!removalForm.check(target, { password: [required('Enter your current password.')] })) return;
            setRemovingWith(String(new FormData(target).get('password')));
          }}
        >
          <TextField
            autoComplete="current-password"
            className="min-w-64"
            label="Current password"
            type="password"
            {...removalForm.field('password')}
          />
          <Button className="mt-6" type="submit">
            Delete account
          </Button>
        </form>
        {removingWith !== undefined && (
          <ConfirmDialog
            confirmLabel="Delete my account"
            eyebrow="Delete account"
            onClose={() => setRemovingWith(undefined)}
            onConfirm={async () => {
              await auth.deleteAccount(removingWith);
              navigate('/');
            }}
            title="Delete your account?"
          >
            <p className="m-0">
              Your library, ratings, reviews, reports and activity are deleted with it. This cannot be
              undone.
            </p>
          </ConfirmDialog>
        )}
      </Section>
    </div>
  );
}
