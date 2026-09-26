import { useEffect, useRef, useState, type ReactNode } from 'react';

export function SmoothImage({
  alt,
  fallback = null,
  src,
}: {
  alt: string;
  fallback?: ReactNode;
  src: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth > 0) setState('loaded');
  }, []);

  if (state === 'failed') return fallback;
  return (
    <>
      {state === 'loading' && <span aria-hidden="true" className="skeleton absolute inset-0 rounded-none" />}
      <img
        alt={alt}
        className={`poster-image relative h-full w-full object-cover ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onError={() => setState('failed')}
        onLoad={() => setState('loaded')}
        ref={image}
        referrerPolicy="no-referrer"
        src={src}
      />
    </>
  );
}
