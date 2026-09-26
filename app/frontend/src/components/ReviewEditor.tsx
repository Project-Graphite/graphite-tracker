import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { reviewBodyLimit, type OwnReview } from '../reviews';
import { ConfirmDialog } from './ConfirmDialog';
import { ReviewCard } from './ReviewCard';

export function ReviewEditor({
  defaultVisibility,
  itemId,
  onClose,
  onSaved,
  review,
}: {
  defaultVisibility: OwnReview['visibility'];
  itemId: string;
  onClose: () => void;
  onSaved: (review: OwnReview | null) => void;
  review: OwnReview | null;
}) {
  const auth = useAuth();
  const [rating, setRating] = useState(review?.rating ?? null);
  const [title, setTitle] = useState(review?.title ?? '');
  const [body, setBody] = useState(review?.body ?? '');
  const [containsSpoilers, setContainsSpoilers] = useState(review?.containsSpoilers ?? false);
  const [visibility, setVisibility] = useState(review?.visibility ?? defaultVisibility);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(errorMessage(reason, fallback));
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      onSaved(
        await auth.request<OwnReview>(`/items/${itemId}/review`, {
          method: 'PUT',
          body: JSON.stringify({ rating, title, body, containsSpoilers, visibility }),
        }),
      );
    }, 'Could not save your review');
  }


  return (
    <form className="grid gap-5" noValidate onSubmit={save}>
      <fieldset className="m-0 border-0 p-0">
        <legend className="field-label mb-2">Rating</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <label key={value}>
              <input
                checked={rating === value}
                className="peer sr-only"
                name="rating"
                onChange={() => setRating(value)}
                type="radio"
              />
              <span className="mono-sm flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-line text-muted transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-muted">
                {value}
              </span>
            </label>
          ))}
          {rating !== null && (
            <button className="text-button mono-sm ml-2" onClick={() => setRating(null)} type="button">
              clear
            </button>
          )}
        </div>
      </fieldset>
      <label className="field-label">
        Review title
        <input maxLength={200} onChange={(event) => setTitle(event.target.value)} value={title} />
      </label>
      <label className="field-label">
        Review
        <textarea
          maxLength={reviewBodyLimit}
          onChange={(event) => setBody(event.target.value)}
          rows={7}
          value={body}
        />
        {body.length >= 8_000 && (
          <span aria-live="polite" className="mono-sm text-faint">
            {body.length.toLocaleString()} / {reviewBodyLimit.toLocaleString()} characters
          </span>
        )}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Visibility
          <select
            onChange={(event) => setVisibility(event.target.value as OwnReview['visibility'])}
            value={visibility}
          >
            <option value="public">Public</option>
            <option value="private">Private, only you and administrators</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-sm text-muted">
          <input
            checked={containsSpoilers}
            onChange={(event) => setContainsSpoilers(event.target.checked)}
            type="checkbox"
          />
          Contains spoilers
        </label>
      </div>
      <p className="mono-sm m-0 text-faint">
        Ratings count toward the site average. Public reviews appear on this title for everyone.
      </p>
      {preview && auth.user && (
        <div className="rounded-xl border border-line px-5">
          <ReviewCard
            key={`${containsSpoilers}`}
            review={{
              id: review?.id ?? 'preview',
              author: { handle: auth.user.handle, displayName: auth.user.displayName },
              rating,
              title: title.trim() || null,
              body: body.trim() || null,
              containsSpoilers,
              visibility,
              updatedAt: new Date().toISOString(),
            }}
          />
        </div>
      )}
      {error && <p className="error-message m-0">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="primary-button" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          aria-pressed={preview}
          className="secondary-button"
          onClick={() => setPreview((current) => !current)}
          type="button"
        >
          {preview ? 'Hide preview' : 'Preview'}
        </button>
        <button className="text-button text-sm" disabled={busy} onClick={onClose} type="button">
          Cancel
        </button>
        {review && !review.hidden && (
          <button className="text-button ml-auto text-sm" disabled={busy} onClick={() => setDeleting(true)} type="button">
            Delete review
          </button>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          confirmLabel="Delete"
          eyebrow="Your review"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await auth.request(`/items/${itemId}/review`, { method: 'DELETE' });
            onSaved(null);
          }}
          title="Delete your rating and review?"
        >
          <p className="m-0">They are removed from this title, your profile and the site average.</p>
        </ConfirmDialog>
      )}
    </form>
  );
}
