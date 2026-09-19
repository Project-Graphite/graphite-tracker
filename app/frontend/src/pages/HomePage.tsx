import { Link } from 'react-router-dom';

const categories = ['Movies', 'TV shows', 'Anime', 'Manga', 'Manhwa', 'Games'];

export function HomePage() {
  return (
    <div className="page-enter">
      <section className="grid gap-10 border-b border-line pb-14 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
        <div>
          <p className="eyebrow">One library · every medium</p>
          <h1 className="mt-4 max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.055em] sm:text-7xl">
            Keep every story you follow in one quiet place.
          </h1>
        </div>
        <div>
          <p className="m-0 max-w-md text-lg text-muted">
            Discover films now. Television, anime, manga, manhwa and games join the same library as
            the catalogue grows.
          </p>
          <Link className="primary-button mt-7 inline-flex" to="/discover/movies/recent">
            Find a movie
          </Link>
        </div>
      </section>
      <section className="py-12">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-2xl font-semibold tracking-tight">Six categories. One account.</h2>
          <span className="mono-sm text-faint">movie slice live</span>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, index) => (
            <div className="bg-surface p-6" key={category}>
              <span className="mono-sm text-faint">0{index + 1}</span>
              <h3 className="mt-8 mb-1 text-xl font-medium">{category}</h3>
              <p className="m-0 text-sm text-muted">{index === 0 ? 'Search and track now' : 'Foundation ready'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
