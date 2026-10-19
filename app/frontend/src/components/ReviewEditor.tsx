import Alert from '@mui/material/Alert';
import FormLabel from '@mui/material/FormLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useState, type FormEvent } from 'react';
import { Button, Checkbox, ConfirmDialog, errorMessage, TextAreaField, TextField, Toggle } from '@project-graphite/ui';
import { useAuth } from '../auth';
import { reviewBodyLimit, type OwnReview } from '../reviews';
import { ReviewCard } from './ReviewCard';

export function ReviewEditor({
  itemId,
  onClose,
  onSaved,
  review,
}: {
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
  const [visibility, setVisibility] = useState<OwnReview['visibility']>(review?.visibility ?? 'public');
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
        <FormLabel className="mb-2" component="legend">Rating</FormLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToggleButtonGroup aria-label="Rating" className="flex-wrap" exclusive onChange={(_, value: number | null) => setRating(value)} size="small" value={rating}>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <ToggleButton className="mono-sm w-9" key={value} value={value}>
                {value}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {rating !== null && (
            <Button className="mono-sm ml-2" onClick={() => setRating(null)} size="small" variant="text">
              clear
            </Button>
          )}
        </div>
      </fieldset>
      <TextField label="Review title" maxLength={200} onChange={(event) => setTitle(event.target.value)} value={title} />
      <TextAreaField
        hint={
          body.length >= 8_000 && (
            <span aria-live="polite" className="mono-sm text-faint">
              {body.length.toLocaleString()} / {reviewBodyLimit.toLocaleString()} characters
            </span>
          )
        }
        label="Review"
        maxLength={reviewBodyLimit}
        onChange={(event) => setBody(event.target.value)}
        rows={7}
        value={body}
      />
      <div className="grid items-center gap-4 sm:grid-cols-2">
        <Toggle
          checked={visibility === 'private'}
          label="Private"
          onChange={(checked) => setVisibility(checked ? 'private' : 'public')}
        />
        <Checkbox
          checked={containsSpoilers}
          label="Contains spoilers"
          onChange={(event) => setContainsSpoilers(event.target.checked)}
        />
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
      {error && <Alert severity="error">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy} type="submit" variant="primary">
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button aria-pressed={preview} onClick={() => setPreview((current) => !current)}>
          {preview ? 'Hide preview' : 'Preview'}
        </Button>
        <Button disabled={busy} onClick={onClose} size="small" variant="text">
          Cancel
        </Button>
        {review && !review.hidden && (
          <Button className="ml-auto" disabled={busy} onClick={() => setDeleting(true)} size="small" variant="text">
            Delete review
          </Button>
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
