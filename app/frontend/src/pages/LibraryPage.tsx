import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { Page } from '../api';
import { catalogCategories, categoryLabels, countLabel } from '../catalog';
import { EmptyState } from '../components/EmptyState';
import { LibraryCard } from '../components/LibraryCard';
import { Pagination } from '../components/Pagination';
import { posterGridClass } from '../components/Poster';
import { libraryStateLabels, libraryStates, type LibraryEntry } from '../library';
import { useResource } from '../useResource';

const filterKeys = ['category', 'state', 'query', 'sort'] as const;

export function LibraryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const layout = searchParams.get('view') === 'list' ? 'list' : 'grid';
  const parameters = new URLSearchParams();
  for (const key of [...filterKeys, 'page']) {
    const value = searchParams.get(key);
    if (value) parameters.set(key, value);
  }
  const library = useResource<Page<LibraryEntry>>(`/library?${parameters.toString()}`, true);
  const filtered = filterKeys.some((key) => key !== 'sort' && searchParams.get(key));

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    navigate(`/library?${next.toString()}`);
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    go({ query: String(new FormData(event.currentTarget).get('query')).trim() });
  }

  function pageHref(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    return `/library?${next.toString()}`;
  }

  const replace = (entry: LibraryEntry) =>
    library.mutate((current) => ({
      ...current,
      results: current.results.map((item) => (item.id === entry.id ? entry : item)),
    }));
  const remove = (id: string) =>
    library.mutate((current) => ({
      ...current,
      totalResults: current.totalResults - 1,
      results: current.results.filter((item) => item.id !== id),
    }));

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your collection</p>
          <h1 className="page-title">Library</h1>
        </div>
        <div aria-label="Layout" className="flex gap-2" role="group">
          {(['grid', 'list'] as const).map((option) => (
            <button
              aria-pressed={layout === option}
              className={`secondary-button px-3 py-2 text-sm capitalize ${layout === option ? 'border-ink' : ''}`}
              key={option}
              onClick={() => go({ view: option === 'grid' ? '' : option, page: searchParams.get('page') ?? '' })}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <form onSubmit={search} role="search">
          <label className="field-label">
            Search
            <input defaultValue={searchParams.get('query') ?? ''} key={searchParams.get('query')} name="query" placeholder="Title" type="search" />
          </label>
        </form>
        <label className="field-label">
          Category
          <select onChange={(event) => go({ category: event.target.value })} value={searchParams.get('category') ?? ''}>
            <option value="">All categories</option>
            {catalogCategories.map((category) => (
              <option key={category} value={category}>{categoryLabels[category]}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          List
          <select onChange={(event) => go({ state: event.target.value })} value={searchParams.get('state') ?? ''}>
            <option value="">All lists</option>
            {libraryStates.map((state) => (
              <option key={state} value={state}>{libraryStateLabels[state]}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Sort
          <select onChange={(event) => go({ sort: event.target.value })} value={searchParams.get('sort') ?? ''}>
            <option value="">Recently updated</option>
            <option value="title">Title</option>
            <option value="release">Release date</option>
          </select>
        </label>
      </div>
      {library.error && <p className="error-message mt-6">{library.error}</p>}
      {library.loading ? (
        <p className="mt-9 text-muted">Loading your library…</p>
      ) : (
        library.data && (
          <section className="mt-9">
            <p className="mono-sm mt-0 mb-5 text-faint">{countLabel(library.data.totalResults, 'title')}</p>
            {library.data.results.length === 0 ? (
              <EmptyState title={filtered ? 'Nothing matches these filters' : 'Your library is empty'}>
                <p className="mt-2 text-muted">
                  {filtered ? 'Try another search or list.' : 'Discover a title and add it to a list.'}
                </p>
                {!filtered && (
                  <Link className="primary-button mt-3 inline-flex" to="/discover/movie/recent">
                    Discover titles
                  </Link>
                )}
              </EmptyState>
            ) : (
              <div className={layout === 'grid' ? posterGridClass : 'border-t border-line-soft'}>
                {library.data.results.map((entry) => (
                  <LibraryCard
                    entry={entry}
                    key={entry.id}
                    layout={layout}
                    onChange={replace}
                    onRemove={() => remove(entry.id)}
                  />
                ))}
              </div>
            )}
            <Pagination page={library.data.page} pageHref={pageHref} totalPages={library.data.totalPages} />
          </section>
        )
      )}
    </div>
  );
}
