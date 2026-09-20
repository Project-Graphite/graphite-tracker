import { type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { catalogCategories, categoryLabels, type CatalogCategory } from '../catalog';

const descriptions: Record<CatalogCategory, string> = {
  movie: 'Feature films and documentaries from TMDB.',
  tv: 'Series, seasons, and episode progress from TMDB.',
  anime: 'Japanese animated films and series classified from TMDB.',
  manga: 'Japanese and international comics from MangaDex.',
  manhwa: 'Korean-origin comics from MangaDex.',
  game: 'Games, platforms, franchises, DLC, and expansions from IGDB.',
};

export function HomePage() {
  const navigate = useNavigate();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = String(form.get('category')) as CatalogCategory;
    const query = String(form.get('query')).trim();
    navigate(`/discover/${category}/search?q=${encodeURIComponent(query)}&page=1`);
  }

  return (
    <div className="page-enter">
      <section className="grid gap-10 border-b border-line pb-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <p className="eyebrow">One library · every medium</p>
          <h1 className="display-title">Track what you watch, read, and play.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Discover six entertainment categories, keep one canonical library, and record progress appropriate to every kind of title.
          </p>
        </div>
        <form className="grid gap-3 rounded-xl border border-line bg-surface p-5" onSubmit={search}>
          <label className="field-label">
            Search category
            <select defaultValue="movie" name="category">
              {catalogCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label className="field-label">
            Title
            <input minLength={2} name="query" placeholder="What are you looking for?" required />
          </label>
          <button className="primary-button" type="submit">Search catalogue</button>
        </form>
      </section>
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="m-0 text-2xl font-medium">Browse by category</h2>
          <span className="mono-sm text-faint">six catalogues · one library</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogCategories.map((category) => (
            <Link className="rounded-xl border border-line bg-surface p-5 text-ink no-underline transition-colors hover:border-ink" key={category} to={`/discover/${category}/popular`}>
              <span className="mono-sm text-faint">{category}</span>
              <h3 className="mt-2 mb-0 text-xl font-medium">{categoryLabels[category]}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{descriptions[category]}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
