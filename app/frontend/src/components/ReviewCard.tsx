import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { itemHref, reportReasons, type ItemSummary, type PublicReview } from '../reviews';
import { Dialog } from './Dialog';

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
          <button className="primary-button justify-self-end" onClick={onClose} type="button">
            Done
          </button>
        </div>
      ) : (
        <form className="mt-6 grid gap-5" onSubmit={(event) => void report(event)}>
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="field-label mb-2">What is wrong with it?</legend>
            {Object.entries(reportReasons).map(([value, label]) => (
              <label className="flex items-center gap-2 text-sm text-muted" key={value}>
                <input
                  checked={reason === value}
                  name="reason"
                  onChange={() => setReason(value as keyof typeof reportReasons)}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
          {error && <p className="error-message m-0">{error}</p>}
          <div className="flex justify-end gap-3">
            <button className="secondary-button" disabled={busy} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? 'Sending…' : 'Send report'}
            </button>
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
  const reportable = auth.user && auth.user.handle !== review.author.handle;

  return (
    <article className="border-b border-line-soft py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="m-0 text-sm">
          <Link className="rule-link" to={`/users/${review.author.handle}`}>
            {review.author.displayName}
          </Link>{' '}
          <span className="mono-sm text-faint">
            {[
              review.rating !== null && `${review.rating}/10`,
              new Date(review.updatedAt).toLocaleDateString(),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </p>
        {reportable && (
          <button className="text-button mono-sm" onClick={() => setReporting(true)} type="button">
            report
          </button>
        )}
      </div>
      {item && (
        <p className="mono-sm mt-1 mb-0 text-faint">
          on {href ? <Link className="rule-link" to={href}>{item.title}</Link> : item.title}
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
        <div className="notice mt-3 flex flex-wrap items-center justify-between gap-3">
          <span>This review contains spoilers.</span>
          <button
            className="secondary-button px-3 py-1.5 text-sm"
            onClick={() => setRevealed(true)}
            type="button"
          >
            Show review
          </button>
        </div>
      )}
      {reporting && <ReportDialog onClose={() => setReporting(false)} review={review} />}
    </article>
  );
}
