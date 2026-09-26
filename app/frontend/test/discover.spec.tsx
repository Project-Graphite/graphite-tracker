import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const mangaSource = (key: string, displayName: string) => ({
  key,
  displayName,
  categories: ['manga', 'manhwa'],
  attribution: displayName,
  enabled: true,
});

describe('Discover filters', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('offers the sorts and statuses of the manga source in use and drops them when the source changes', async () => {
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      if (url.includes('/catalog/sources')) {
        return Promise.resolve(
          json([mangaSource('mangaupdates', 'MangaUpdates'), mangaSource('mangadex', 'MangaDex')]),
        );
      }
      if (url.includes('/genres')) return Promise.resolve(json(['Romance']));
      if (url.includes('/catalog/')) {
        return Promise.resolve(
          json({ page: 1, totalPages: 1, totalResults: 0, results: [], attribution: 'Test' }),
        );
      }
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const browses = () =>
      fetchMock.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/catalog/manga/popular'));
    const sorts = () =>
      [...container.querySelectorAll<HTMLOptionElement>('select[name="sort"] option')].map(
        ({ value }) => value,
      );

    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/discover/manga/popular?genre=Romance&year=2020&sort=list_reading']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );

    expect(browses()).toEqual([
      '/api/v1/catalog/manga/popular?page=1&genre=Romance&year=2020&sort=list_reading',
    ]);
    expect(sorts()).toEqual(['', 'list_reading', 'month1_pos', 'rating']);
    expect(container.querySelector('select[name="status"]')).toBeNull();

    const form = container.querySelector<HTMLFormElement>('#discover-filters');
    form!.querySelector<HTMLSelectElement>('select[name="source"]')!.value = 'mangadex';
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(browses().at(-1)).toBe('/api/v1/catalog/manga/popular?page=1&year=2020&source=mangadex');
    expect(sorts()).toEqual(['', 'followedCount', 'latestUploadedChapter']);
    expect(container.querySelector('select[name="status"]')).not.toBeNull();
  });

  it('offers AniList sorts and statuses for anime unless TMDB is chosen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = String(input);
        if (url.includes('/catalog/sources')) {
          return Promise.resolve(
            json([
              { ...mangaSource('anilist', 'AniList'), categories: ['anime'] },
              { ...mangaSource('tmdb', 'TMDB'), categories: ['movie', 'tv', 'anime'] },
            ]),
          );
        }
        if (url.includes('/catalog/')) {
          return Promise.resolve(
            json({ page: 1, totalPages: 1, totalResults: 0, results: [], attribution: 'Test' }),
          );
        }
        return Promise.resolve(new Response(null, { status: 401 }));
      }),
    );
    const values = (name: string) =>
      [...container.querySelectorAll<HTMLOptionElement>(`select[name="${name}"] option`)].map(
        ({ value }) => value,
      );
    const render = (path: string) =>
      act(async () =>
        root.render(
          <MemoryRouter initialEntries={[path]}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </MemoryRouter>,
        ),
      );

    await render('/discover/anime/recent');

    expect(values('sort')).toEqual([
      '',
      'TRENDING_DESC',
      'POPULARITY_DESC',
      'SCORE_DESC',
      'START_DATE_DESC',
    ]);
    expect(values('status')).toEqual([
      '',
      'releasing',
      'finished',
      'not_yet_released',
      'hiatus',
      'cancelled',
    ]);

    act(() => root.unmount());
    root = createRoot(container);
    await render('/discover/anime/recent?source=tmdb');

    expect(values('sort')).toEqual(['', 'popularity.desc', 'vote_average.desc', 'first_air_date.desc']);
    expect(values('status')).toContain('returning');
  });
});
