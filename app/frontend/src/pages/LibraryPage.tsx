import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, EmptyState, ListSkeleton, Pagination, Select, Skeleton, TextField } from '@project-graphite/ui';
import type { Page } from '../api';
import { catalogCategories, categoryLabels, countLabel } from '../catalog';
import { LibraryCard } from '../components/LibraryCard';
import { posterGridClass } from '../components/Poster';
import { PosterGridSkeleton } from '../components/Skeleton';
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
        <div className="flex flex-wrap items-center gap-2">
          <Button href="/import" size="small">
            Import backup
          </Button>
          <ToggleButtonGroup aria-label="Layout" exclusive size="small" value={layout}>
          {(['grid', 'list'] as const).map((option) => (
            <ToggleButton
              className="capitalize"
              key={option}
              onClick={() => go({ view: option === 'grid' ? '' : option, page: searchParams.get('page') ?? '' })}
              value={option}
            >
              {option}
            </ToggleButton>
          ))}
          </ToggleButtonGroup>
        </div>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <form className="col-span-2 lg:col-span-1" onSubmit={search} role="search">
          <TextField defaultValue={searchParams.get('query') ?? ''} key={searchParams.get('query')} label="Search" name="query" placeholder="Title" type="search" />
        </form>
        <Select
          label="Category"
          onChange={(value) => go({ category: value })}
          options={[
            { value: '', label: 'All categories' },
            ...catalogCategories.map((category) => ({ value: category, label: categoryLabels[category] })),
          ]}
          value={searchParams.get('category') ?? ''}
        />
        <Select
          label="List"
          onChange={(value) => go({ state: value })}
          options={[
            { value: '', label: 'All lists' },
            ...libraryStates.map((state) => ({ value: state, label: libraryStateLabels[state] })),
          ]}
          value={searchParams.get('state') ?? ''}
        />
        <Select
          className="col-span-2 lg:col-span-1"
          label="Sort"
          onChange={(value) => go({ sort: value })}
          options={[
            { value: '', label: 'Recently updated' },
            { value: 'title', label: 'Title' },
            { value: 'release', label: 'Release date' },
          ]}
          value={searchParams.get('sort') ?? ''}
        />
      </div>
      {library.error && <Alert className="mt-6" severity="error">{library.error}</Alert>}
      {library.loading ? (
        <div className="mt-9">
          <Skeleton className="mb-5 h-3.5 w-20" />
          {layout === 'grid' ? (
            <PosterGridSkeleton label="Loading your library" />
          ) : (
            <ListSkeleton label="Loading your library" rows={8} />
          )}
        </div>
      ) : (
        library.data && (
          <section className="fade-in mt-9">
            <p className="mono-sm mt-0 mb-5 text-faint">{countLabel(library.data.totalResults, 'title')}</p>
            {library.data.results.length === 0 ? (
              <EmptyState title={filtered ? 'Nothing matches these filters' : 'Your library is empty'}>
                <p className="mt-2 text-muted">
                  {filtered ? 'Try another search or list.' : 'Discover a title and add it to a list.'}
                </p>
                {!filtered && (
                  <Button className="mt-3" href="/discover/movie/recent" variant="primary">
                    Discover titles
                  </Button>
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
            <Pagination maxPages={500} page={library.data.page} pageHref={pageHref} totalPages={library.data.totalPages} />
          </section>
        )
      )}
    </div>
  );
}
