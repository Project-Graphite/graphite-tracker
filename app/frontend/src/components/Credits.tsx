import type { CatalogCategory, CatalogDetails } from '../catalog';
import { SmoothImage } from './SmoothImage';

const headings: Record<CatalogCategory, string> = {
  movie: 'Cast & crew',
  tv: 'Cast & crew',
  anime: 'Staff & voice cast',
  manga: 'Creators',
  manhwa: 'Creators',
  game: 'Developers & publishers',
};

export function Credits({ item }: { item: CatalogDetails }) {
  const credits = item.credits ?? [];
  const cast = item.cast ?? [];
  if (credits.length === 0 && cast.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="m-0 text-xl font-medium">{headings[item.category]}</h2>
      {credits.length > 0 && (
        <dl className="mt-4 mb-0 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {credits.map((credit) => (
            <div className="min-w-0" key={credit.role}>
              <dt className="mono-sm text-faint">{credit.role}</dt>
              <dd className="m-0 mt-1 text-muted">{credit.names.join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}
      {cast.length > 0 && (
        <ul aria-label={item.category === 'anime' ? 'Voice cast' : 'Cast'} className="cast-row mt-6 mb-0 p-0">
          {cast.map((member, index) => (
            <li className="min-w-0 list-none snap-start" key={`${member.name}:${index}`}>
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line bg-line-soft">
                {member.imageUrl ? (
                  <SmoothImage alt="" src={member.imageUrl} />
                ) : (
                  <span aria-hidden="true" className="flex h-full items-center justify-center text-2xl text-faint">
                    {member.name.charAt(0)}
                  </span>
                )}
              </div>
              <p className="mt-2 mb-0 line-clamp-2 text-sm leading-snug text-ink">{member.name}</p>
              {member.character && (
                <p className="mono-sm mt-0.5 mb-0 line-clamp-2 text-faint">{member.character}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
