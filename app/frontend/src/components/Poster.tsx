import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

export const posterGridClass =
  'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

function PosterImage({ posterUrl, title }: { posterUrl: string; title: string }) {
  const image = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <img
      alt={`Poster for ${title}`}
      className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      ref={image}
      referrerPolicy="no-referrer"
      src={posterUrl}
    />
  );
}

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
    <PosterImage key={posterUrl} posterUrl={posterUrl} title={title} />
  ) : (
    <span className="flex h-full items-center justify-center p-3 text-center text-sm text-muted">
      {title}
    </span>
  );
  const frame = `block aspect-[2/3] overflow-hidden rounded-lg border border-line bg-line-soft ${className}`;
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
