import Alert from '@mui/material/Alert';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  actionSkeletonClass,
  Button,
  Checkbox,
  Dialog,
  errorMessage,
  Select,
  Skeleton,
  useSnackbar,
  type ButtonVariant,
} from '@project-graphite/ui';
import { useAdultBlur } from '../adultContent';
import { useAuth } from '../auth';
import { catalogRef, titleHref, type CatalogCandidate } from '../catalog';
import {
  libraryStates,
  stateLabel,
  type LibraryEntry,
  type LibraryState,
} from '../library';
import { useLibraryStates } from '../useLibraryStates';
import { Poster, posterGridClass } from './Poster';

function AddToListDialog({
  item,
  onAdded,
  onClose,
}: {
  item: CatalogCandidate;
  onAdded: (entry: LibraryEntry) => void;
  onClose: () => void;
}) {
  const auth = useAuth();
  const show = useSnackbar();
  const [state, setState] = useState<LibraryState>('planned');
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onAdded(
        await auth.request<LibraryEntry>('/library', {
          method: 'POST',
          body: JSON.stringify({
            externalId: item.externalId,
            category: item.category,
            source: item.source,
            state,
            isPrivate,
          }),
        }),
      );
      show({ message: `${item.title} added to your library`, detail: stateLabel(item.category, state) });
      onClose();
    } catch (reason) {
      setError(errorMessage(reason, 'Could not add this title'));
      setBusy(false);
    }
  }

  return (
    <Dialog eyebrow="Add to list" onClose={onClose} title={item.title}>
      <form className="mt-6 grid gap-5" onSubmit={(event) => void add(event)}>
        <Select
          label="List"
          onChange={(value) => setState(value)}
          options={libraryStates.map((value) => ({ value, label: stateLabel(item.category, value) }))}
          value={state}
        />
        <Checkbox
          checked={isPrivate}
          label="Hide from my profile"
          onChange={(event) => setIsPrivate(event.target.checked)}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <div className="flex justify-end gap-3">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} type="submit" variant="primary">
            {busy ? 'Adding…' : 'Add to list'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AddToListButton({
  entry,
  item,
  libraryReady,
  onAdded,
  size = 'small',
  variant = 'secondary',
}: {
  entry: LibraryEntry | null;
  item: CatalogCandidate;
  libraryReady: boolean;
  onAdded: (entry: LibraryEntry) => void;
  size?: 'small' | 'medium';
  variant?: ButtonVariant;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!libraryReady) {
    return <Skeleton className={actionSkeletonClass} />;
  }

  if (entry) {
    return (
      <p className="mono-sm m-0 rounded-lg border border-line-soft px-3 py-2 text-center text-muted">
        {stateLabel(item.category, entry.state)}
      </p>
    );
  }

  return (
    <>
      <Button
        className="w-full"
        onClick={() => (auth.user ? setOpen(true) : navigate('/login'))}
        size={size}
        variant={variant}
      >
        Add to list
      </Button>
      {open && <AddToListDialog item={item} onAdded={onAdded} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CatalogCard({
  entry,
  item,
  libraryReady,
  onAdded,
}: {
  entry: LibraryEntry | null;
  item: CatalogCandidate;
  libraryReady: boolean;
  onAdded: (entry: LibraryEntry) => void;
}) {
  const blur = useAdultBlur();
  const href = titleHref(item);
  return (
    <article className="flex h-full min-w-0 flex-col">
      <Poster blurred={blur(item.adult)} href={href} posterUrl={item.posterUrl} title={item.title} />
      <h3 className="mt-3 mb-0 line-clamp-2 text-sm leading-snug font-medium">
        <Link className="text-ink no-underline hover:underline" to={href}>
          {item.title}
        </Link>
      </h3>
      <p className="mono-sm mt-1 mb-3 text-faint">
        {[
          item.releaseDate?.slice(0, 4),
          item.rating ? `${item.rating.toFixed(1)}/10` : null,
          item.adult ? '18+' : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Date unknown'}
      </p>
      <div className="mt-auto">
        <AddToListButton
          entry={entry}
          item={item}
          libraryReady={libraryReady}
          onAdded={onAdded}
        />
      </div>
    </article>
  );
}

export function CatalogGrid({
  items,
  onAdded,
}: {
  items: CatalogCandidate[];
  onAdded?: (entry: LibraryEntry) => void;
}) {
  const library = useLibraryStates(items);
  return (
    <>
      {library.error && <Alert className="mb-5" severity="error">{library.error}</Alert>}
      <div className={posterGridClass}>
        {items.map((item) => (
          <CatalogCard
            entry={library.entryFor(item)}
            item={item}
            key={catalogRef(item)}
            libraryReady={library.ready}
            onAdded={(entry) => {
              library.add(entry);
              onAdded?.(entry);
            }}
          />
        ))}
      </div>
    </>
  );
}
