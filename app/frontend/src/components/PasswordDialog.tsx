import Alert from '@mui/material/Alert';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Dialog, errorMessage, TextField } from '@project-graphite/ui';

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
        {error && <Alert severity="error">{error}</Alert>}
        <div className="flex justify-end gap-3">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} type="submit" variant="primary">
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
