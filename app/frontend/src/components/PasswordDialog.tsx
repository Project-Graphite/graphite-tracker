import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '../api';
import { Dialog } from './Dialog';
import { TextField } from './Field';

export function PasswordDialog({
  children,
  confirmLabel,
  eyebrow,
  onClose,
  onConfirm,
  title,
}: {
  children: ReactNode;
  confirmLabel: string;
  eyebrow: string;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    if (!password) {
      setMissing(true);
      event.currentTarget.querySelector('input')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save this change'));
      setBusy(false);
    }
  }

  return (
    <Dialog eyebrow={eyebrow} onClose={onClose} title={title}>
      <form className="mt-6 grid gap-5" noValidate onSubmit={(event) => void confirm(event)}>
        <div className="grid gap-3 text-sm text-muted">{children}</div>
        <TextField
          autoComplete="current-password"
          error={missing ? 'Enter your password to confirm.' : undefined}
          label="Your password"
          name="password"
          onInput={() => setMissing(false)}
          type="password"
        />
        {error && <p className="error-message m-0">{error}</p>}
        <div className="flex justify-end gap-3">
          <button className="secondary-button" disabled={busy} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
