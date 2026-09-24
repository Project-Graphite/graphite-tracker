import { useState } from 'react';
import { Link } from 'react-router';
import { categoryLabels } from '../catalog';
import {
  entryHref,
  progressSummary,
  stateLabel,
  type LibraryEntry,
} from '../library';
import { Dialog } from './Dialog';
import { LibraryEntryEditor } from './LibraryEntryEditor';
import { Poster } from './Poster';

export function LibraryCard({
  entry,
  layout,
  onChange,
  onRemove,
}: {
  entry: LibraryEntry;
  layout: 'grid' | 'list';
  onChange: (entry: LibraryEntry) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const href = entryHref(entry);
  const summary = [stateLabel(entry.item.category, entry.state), progressSummary(entry.progress)]
    .filter(Boolean)
    .join(' · ');
  const meta = [categoryLabels[entry.item.category], entry.item.releaseDate?.slice(0, 4)]
    .filter(Boolean)
    .join(' · ');
  const title = href ? (
    <Link className="text-ink no-underline hover:underline" to={href}>
      {entry.item.title}
    </Link>
  ) : (
    entry.item.title
  );
  const editButton = (
    <button
      className={`secondary-button px-3 py-2 text-sm ${layout === 'grid' ? 'w-full' : ''}`}
      onClick={() => setEditing(true)}
      type="button"
    >
      Edit
    </button>
  );

  return (
    <>
      {layout === 'grid' ? (
        <article className="flex h-full min-w-0 flex-col">
          <Poster href={href} posterUrl={entry.item.posterUrl} title={entry.item.title} />
          <h3 className="mt-3 mb-0 line-clamp-2 text-sm leading-snug font-medium">{title}</h3>
          <p className="mono-sm mt-1 mb-0 text-faint">{meta}</p>
          <p className="mt-1 mb-3 text-sm text-muted">{summary}</p>
          <div className="mt-auto">{editButton}</div>
        </article>
      ) : (
        <article className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-line-soft py-3">
          <Poster href={href} posterUrl={entry.item.posterUrl} title={entry.item.title} />
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-medium">{title}</h3>
            <p className="mono-sm mt-1 mb-0 text-faint">{meta}</p>
            <p className="mt-1 mb-0 text-sm text-muted">{summary}</p>
          </div>
          {editButton}
        </article>
      )}
      {editing && (
        <Dialog eyebrow="Edit entry" onClose={() => setEditing(false)} title={entry.item.title}>
          <div className="mt-6">
            <LibraryEntryEditor entry={entry} onChange={onChange} onRemove={onRemove} />
          </div>
        </Dialog>
      )}
    </>
  );
}
