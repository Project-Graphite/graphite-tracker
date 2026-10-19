import Alert from '@mui/material/Alert';
import { useState } from 'react';
import { Button, errorMessage } from '@project-graphite/ui';
import { apiRequest } from '../api';

export function ResendVerification({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function resend() {
    setState('sending');
    setError('');
    try {
      await apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setState('sent');
    } catch (reason) {
      setError(errorMessage(reason, 'Could not send the link'));
      setState('idle');
    }
  }

  return (
    <div className="mt-6 text-sm text-muted">
      {state === 'sent' ? (
        <p className="m-0">A new link is on its way. It works for 24 hours.</p>
      ) : (
        <p className="m-0">
          Nothing arrived?{' '}
          <Button
            disabled={state === 'sending'}
            onClick={() => void resend()}
            size="small"
            variant="text"
          >
            Send the link again
          </Button>
        </p>
      )}
      {error && <Alert className="mt-2" severity="error">{error}</Alert>}
    </div>
  );
}
