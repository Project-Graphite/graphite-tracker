import Alert from '@mui/material/Alert';
import FormLabel from '@mui/material/FormLabel';
import MuiLink from '@mui/material/Link';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, Dialog, errorMessage, Radio } from '@project-graphite/ui';
import { useAuth } from '../auth';
import { itemHref, reportReasons, type ItemSummary, type PublicReview } from '../reviews';

function ReportDialog({ onClose, review }: { onClose: () => void; review: PublicReview }) {
  const auth = useAuth();
  const [reason, setReason] = useState<keyof typeof reportReasons>('spoilers');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.request(`/reviews/${review.id}/reports`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setSent(true);
    } catch (reason) {
      setError(errorMessage(reason, 'Could not send the report'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog eyebrow="Report review" onClose={onClose} title={`Review by ${review.author.displayName}`}>
      {sent ? (
        <div className="mt-6 grid gap-5">
          <p className="m-0 text-muted">Thanks. A moderator will look at this review.</p>
          <Button className="justify-self-end" onClick={onClose} variant="primary">
            Done
          </Button>
        </div>
      ) : (
        <form className="mt-6 grid gap-5" onSubmit={(event) => void report(event)}>
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <FormLabel className="mb-2" component="legend">What is wrong with it?</FormLabel>
            {Object.entries(reportReasons).map(([value, label]) => (
              <Radio
                checked={reason === value}
                key={value}
                label={label}
                name="reason"
                onChange={() => setReason(value as keyof typeof reportReasons)}
              />
            ))}
          </fieldset>
          {error && <Alert severity="error">{error}</Alert>}
          <div className="flex justify-end gap-3">
            <Button disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy} type="submit" variant="primary">
              {busy ? 'Sending…' : 'Send report'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function ReviewCard({ item, review }: { item?: ItemSummary; review: PublicReview }) {
  const auth = useAuth();
  const [revealed, setRevealed] = useState(!review.containsSpoilers);
  const [reporting, setReporting] = useState(false);
  const href = item && itemHref(item);
  const reportable =
    auth.user && auth.user.handle !== review.author.handle && review.visibility === 'public';

  return (
    <article className="border-b border-line-soft py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="m-0 text-sm">
          <MuiLink component={Link} to={`/users/${review.author.handle}`} underline="always">
            {review.author.displayName}
          </MuiLink>{' '}
          <span className="mono-sm text-faint">
            {[
              review.rating !== null && `${review.rating}/10`,
              review.visibility === 'private' && 'private',
              new Date(review.updatedAt).toLocaleDateString(),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </p>
        {reportable && (
          <Button className="mono-sm" onClick={() => setReporting(true)} size="small" variant="text">
            report
          </Button>
        )}
      </div>
      {item && (
        <p className="mono-sm mt-1 mb-0 text-faint">
          on {href ? <MuiLink component={Link} to={href} underline="always">{item.title}</MuiLink> : item.title}
        </p>
      )}
      {revealed ? (
        <>
          {review.title && <h3 className="mt-3 mb-0 text-base font-medium">{review.title}</h3>}
          {review.body && (
            <p className="mt-2 mb-0 max-w-3xl whitespace-pre-line text-muted">{review.body}</p>
          )}
        </>
      ) : (
        <Alert
          action={
            <Button onClick={() => setRevealed(true)} size="small">
              Show review
            </Button>
          }
          className="mt-3"
          severity="info"
        >
          This review contains spoilers.
        </Alert>
      )}
      {reporting && <ReportDialog onClose={() => setReporting(false)} review={review} />}
    </article>
  );
}
