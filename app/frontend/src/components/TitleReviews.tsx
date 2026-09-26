import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth';
import { countLabel, type CatalogDetails } from '../catalog';
import type { LibraryEntry } from '../library';
import type { OwnReview, TitleReviews as TitleReviewsPage } from '../reviews';
import { useResource } from '../useResource';
import { ReviewCard } from './ReviewCard';
import { ReviewEditor } from './ReviewEditor';

const notInLibrary =
  'Add this title to your library and finish or drop it to rate and review it.';

interface Privacy {
  privacy: { isPublic: boolean; showReviews: boolean };
}

function YourReview({
  entry,
  itemId,
  onSaved,
}: {
  entry: LibraryEntry | null;
  itemId: string;
  onSaved: () => void;
}) {
  const own = useResource<OwnReview | null>(`/items/${itemId}/review`, true);
  const review = own.data;
  const me = useResource<Privacy>(review === null ? '/me' : null, true);
  const [editing, setEditing] = useState(false);
  const eligible = entry?.state === 'completed' || entry?.state === 'dropped';

  if (own.error) return <p className="error-message">{own.error}</p>;
  if (review === undefined) return null;
  if (!review && !eligible) {
    return (
      <p className="mono-sm m-0 text-faint">
        {entry ? 'Mark this title as completed or dropped to rate and review it.' : notInLibrary}
      </p>
    );
  }
  if (editing) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5">
        <ReviewEditor
          defaultVisibility={
            me.data?.privacy.isPublic && me.data.privacy.showReviews ? 'public' : 'private'
          }
          itemId={itemId}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            own.mutate(() => saved);
            setEditing(false);
            onSaved();
          }}
          review={review}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {review ? (
        <p className="m-0 text-sm text-muted">
          Your {review.body ? 'review' : 'rating'}
          {review.rating !== null && `: ${review.rating}/10`} ·{' '}
          {review.visibility === 'public' ? 'public' : 'private'}
          {review.hidden && ' · hidden by a moderator'}
        </p>
      ) : (
        <p className="m-0 text-sm text-muted">You have not rated this title yet.</p>
      )}
      <button
        className="secondary-button px-3 py-2 text-sm"
        disabled={!review && !me.data && !me.error}
        onClick={() => setEditing(true)}
        type="button"
      >
        {review ? 'Edit' : 'Rate or review'}
      </button>
    </div>
  );
}

export function TitleReviews({
  entry,
  item,
}: {
  entry: LibraryEntry | null | undefined;
  item: CatalogDetails;
}) {
  const auth = useAuth();
  const [page, setPage] = useState(1);
  const reviews = useResource<TitleReviewsPage>(
    auth.ready
      ? `/reviews?source=${encodeURIComponent(item.source)}&externalId=${encodeURIComponent(item.externalId)}&page=${page}`
      : null,
    Boolean(auth.user),
  );
  const itemId = entry?.item.id ?? reviews.data?.itemId ?? null;
  const summary = reviews.data?.rating;

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 text-xl font-medium">Reviews</h2>
        {summary && (
          <p className="mono-sm m-0 text-faint">
            {summary.average === null
              ? 'No site ratings yet'
              : `${summary.average.toFixed(1)}/10 from ${countLabel(summary.count, 'site rating')}`}
          </p>
        )}
      </div>
      <div className="mt-5">
        {!auth.user ? (
          <p className="m-0 text-sm text-muted">
            <Link className="rule-link" to="/login">Sign in</Link> to rate and review.
          </p>
        ) : itemId && entry !== undefined ? (
          <YourReview entry={entry} itemId={itemId} onSaved={reviews.reload} />
        ) : (
          entry === null && <p className="mono-sm m-0 text-faint">{notInLibrary}</p>
        )}
      </div>
      {reviews.error && <p className="error-message mt-5">{reviews.error}</p>}
      {reviews.data && reviews.data.results.length === 0 && (
        <p className="mt-6 text-muted">No public reviews yet.</p>
      )}
      {reviews.data && reviews.data.results.length > 0 && (
        <div className="mt-4">
          {reviews.data.results.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {reviews.data.totalPages > 1 && (
            <div className="mt-5 flex items-center gap-4">
              <button className="secondary-button px-3 py-2 text-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">
                Newer
              </button>
              <span className="mono-sm text-faint">
                Page {page} of {reviews.data.totalPages}
              </span>
              <button
                className="secondary-button px-3 py-2 text-sm"
                disabled={page >= reviews.data.totalPages}
                onClick={() => setPage(page + 1)}
                type="button"
              >
                Older
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
