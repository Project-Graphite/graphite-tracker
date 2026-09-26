import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth';
import { sourceLink } from '../src/catalogSearch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mangaId = '11111111-2222-3333-4444-555555555555';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('Source links in search', () => {
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

  it('recognises pasted links with or without a scheme and leaves titles alone', () => {
    expect(sourceLink(`https://mangadex.org/title/${mangaId}`)).toBe(`https://mangadex.org/title/${mangaId}`);
    expect(sourceLink('www.themoviedb.org/movie/550-fight-club')).toBe(
      'https://www.themoviedb.org/movie/550-fight-club',
    );
    expect(sourceLink('Fight Club')).toBeNull();
    expect(sourceLink('dr. stone')).toBeNull();
  });

  it('opens the title a pasted link points to instead of searching for it', async () => {
    const fetchMock = vi.fn((input: string) => {
      const url = String(input);
      if (url.includes('/catalog/recognize')) {
        return Promise.resolve(json({ category: 'manga', externalId: mangaId, source: 'mangadex' }));
      }
      if (url.includes(`/catalog/manga/${mangaId}`)) {
        return Promise.resolve(
          json({
            source: 'mangadex',
            externalId: mangaId,
            category: 'manga',
            title: 'Tower Story',
            originalTitle: 'Tower Story',
            synopsis: '',
            posterUrl: null,
            backdropUrl: null,
            releaseDate: null,
            language: 'ja',
            genres: [],
            runtimeMinutes: null,
            status: 'ongoing',
            tagline: null,
            rating: null,
            ratingCount: 0,
            adult: false,
            capabilities: { progressUnits: ['chapter', 'volume'] },
            attribution: 'Manga data provided by MangaDex',
          }),
        );
      }
      if (url.includes('/catalog/')) {
        return Promise.resolve(json({ page: 1, totalPages: 1, totalResults: 0, results: [], attribution: 'Test' }));
      }
      return Promise.resolve(new Response(null, { status: 401 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
    const form = container.querySelector<HTMLFormElement>('form[role="search"]');
    const input = form?.querySelector<HTMLInputElement>('input[name="query"]');
    expect(input).toBeTruthy();
    input!.value = `mangadex.org/title/${mangaId}/tower-story`;
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/catalog/recognize?url=${encodeURIComponent(`https://mangadex.org/title/${mangaId}/tower-story`)}`,
      expect.anything(),
    );
    expect(container.querySelector('h1')?.textContent).toBe('Tower Story');
  });
});
