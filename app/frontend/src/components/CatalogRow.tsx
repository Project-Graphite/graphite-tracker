import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { catalogRef, type CatalogCandidate } from '../catalog';
import { useLibraryStates } from '../useLibraryStates';
import { CatalogCard } from './CatalogCard';
import { PosterRowSkeleton } from './Skeleton';

const scrollButtonClass =
  'absolute top-[35%] z-10 hidden -translate-y-1/2 rounded-full border border-line bg-paper/90 p-3 text-ink backdrop-blur-sm transition-colors hover:border-muted hover:bg-surface sm:flex';

function ScrollButton({
  direction,
  label,
  onClick,
}: {
  direction: -1 | 1;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={`${scrollButtonClass} ${direction < 0 ? '-left-3' : '-right-3'}`}
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path
          d={direction < 0 ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </button>
  );
}

export function CatalogRow({
  empty,
  error = '',
  eyebrow,
  items,
  link,
  title,
}: {
  empty: string;
  error?: string;
  eyebrow: ReactNode;
  items: CatalogCandidate[] | undefined;
  link?: { href: string; label: string };
  title: string;
}) {
  const library = useLibraryStates(items);
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const update = () =>
      setEdges({
        start: element.scrollLeft <= 4,
        end: element.scrollLeft >= element.scrollWidth - element.clientWidth - 4,
      });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  }, [items]);

  function scroll(direction: -1 | 1) {
    const element = row.current;
    if (!element) return;
    element.scrollBy({ behavior: 'smooth', left: direction * element.clientWidth });
  }

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 mb-0 text-2xl font-medium">{title}</h2>
        </div>
        {link && (
          <Link className="rule-link mono-sm" to={link.href}>
            {link.label}
          </Link>
        )}
      </div>
      {error || library.error ? (
        <p className="error-message mt-5">{error || library.error}</p>
      ) : !items ? (
        <div className="mt-5">
          <PosterRowSkeleton label={`Loading ${title}`} />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-5 text-muted">{empty}</p>
      ) : (
        <div className="fade-in relative mt-5">
          <div className="catalog-row" ref={row}>
            {items.map((item) => (
              <div className="snap-start" key={catalogRef(item)}>
                <CatalogCard
                  entry={library.entryFor(item)}
                  item={item}
                  libraryReady={library.ready}
                  onAdded={library.add}
                />
              </div>
            ))}
          </div>
          {!edges.start && (
            <ScrollButton direction={-1} label={`Show previous ${title}`} onClick={() => scroll(-1)} />
          )}
          {!edges.end && (
            <ScrollButton direction={1} label={`Show more ${title}`} onClick={() => scroll(1)} />
          )}
        </div>
      )}
    </section>
  );
}
