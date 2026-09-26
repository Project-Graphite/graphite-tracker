import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '../api';
import { Dialog } from './Dialog';

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

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    if (!password) {
      setError('Enter your password to confirm.');
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
        <label className="field-label">
          Your password
          <input autoComplete="current-password" name="password" type="password" />
        </label>
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
