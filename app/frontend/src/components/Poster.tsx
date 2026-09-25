import { Link } from 'react-router';

export const posterGridClass =
  'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

export function Poster({
  className = '',
  href,
  posterUrl,
  title,
}: {
  className?: string;
  href?: string;
  posterUrl: string | null;
  title: string;
}) {
  const image = posterUrl ? (
    <img
      alt={`Poster for ${title}`}
      className="h-full w-full object-cover"
      loading="lazy"
      src={posterUrl}
    />
  ) : (
    <span className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">
      {title}
    </span>
  );
  const frame = `block aspect-[2/3] overflow-hidden rounded-lg border border-line bg-line-soft ${className}`;
  return href ? (
    <Link
      aria-hidden="true"
      className={`${frame} transition-colors hover:border-muted`}
      tabIndex={-1}
      to={href}
    >
      {image}
    </Link>
  ) : (
    <div className={frame}>{image}</div>
  );
}
