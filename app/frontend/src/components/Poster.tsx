import { Link } from 'react-router';
import { SmoothImage } from './SmoothImage';

export const posterGridClass =
  'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export function Poster({
  blurred = false,
  className = '',
  href,
  posterUrl,
  title,
}: {
  blurred?: boolean;
  className?: string;
  href?: string;
  posterUrl: string | null;
  title: string;
}) {
  const placeholder = (
    <span className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">
      {title}
    </span>
  );
  const image = (
    <>
      {posterUrl ? (
        <SmoothImage alt={`Poster for ${title}`} fallback={placeholder} key={posterUrl} src={posterUrl} />
      ) : (
        placeholder
      )}
      {blurred && <span className="poster-badge">18+</span>}
    </>
  );
  const frame = `relative block aspect-[2/3] overflow-hidden rounded-lg border border-line bg-line-soft ${blurred ? 'poster-blurred' : ''} ${className}`;
  return href ? (
    <Link
      aria-hidden="true"
      className={`${frame} poster-link`}
      tabIndex={-1}
      to={href}
    >
      {image}
    </Link>
  ) : (
    <div className={frame}>{image}</div>
  );
}
