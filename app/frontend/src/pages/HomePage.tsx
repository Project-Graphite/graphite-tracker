import Alert from '@mui/material/Alert';
import MuiTextField from '@mui/material/TextField';
import type { FormEvent } from 'react';
import { Button } from '@project-graphite/ui';
import {
  categoryLabels,
  discoverCategories,
  type CatalogResponse,
  type DiscoverCategory,
} from '../catalog';
import { useCatalogSearch } from '../catalogSearch';
import { CatalogRow } from '../components/CatalogRow';
import { useResource } from '../useResource';
import { searchQuery, useFormErrors } from '../validation';

function RecentRow({ category }: { category: DiscoverCategory }) {
  const { data, error } = useResource<CatalogResponse>(`/catalog/${category}/recent?page=1`);
  return (
    <CatalogRow
      empty="No recent titles are available."
      error={error}
      eyebrow="Recently released"
      items={data?.results}
      link={{ href: `/discover/${category}/recent`, label: 'View all' }}
      title={categoryLabels[category]}
    />
  );
}

export function HomePage() {
  const search = useCatalogSearch();
  const form = useFormErrors();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.check(event.currentTarget, { query: searchQuery })) return;
    const query = String(new FormData(event.currentTarget).get('query')).trim();
    void search.submit(query, (value) => `/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <div className="page-enter">
      <section className="border-b border-line pb-12">
        <p className="eyebrow">One library · every medium</p>
        <h1 className="page-title">Track what you watch, read and play.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Movies, TV, anime, manga, manhwa and games in one library, with your progress in each.
        </p>
        <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto]" noValidate onSubmit={submit} role="search">
          <MuiTextField
            name="query"
            placeholder="Search every medium"
            size="small"
            slotProps={{
              htmlInput: {
                'aria-describedby': form.errors.query ? 'search-error' : undefined,
                'aria-invalid': form.errors.query ? true : undefined,
                'aria-label': 'Title',
                onInput: form.field('query').onInput,
              },
            }}
            type="search"
          />
          <Button disabled={search.opening} type="submit" variant="primary">
            {search.opening ? 'Opening…' : 'Search'}
          </Button>
          {(form.errors.query || search.error) && (
            <Alert className="sm:col-span-2" id="search-error" severity="error">
              {form.errors.query || search.error}
            </Alert>
          )}
        </form>
      </section>
      {discoverCategories.map((category) => (
        <RecentRow category={category} key={category} />
      ))}
    </div>
  );
}
