import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('App routes', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(path: string) {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
  }

  it('shows the not-found page for an unknown address instead of redirecting home', async () => {
    await render('/nowhere/at/all');

    expect(container.textContent).toContain('Page not found');
    expect(
      [...container.querySelectorAll('a')].find((link) => link.textContent === 'Go home'),
    ).toHaveProperty('pathname', '/');
  });

  it('shows the not-found page for an unknown discover category', async () => {
    await render('/discover/podcasts/recent');

    expect(container.textContent).toContain('Page not found');
  });

  it('announces a loading placeholder instead of shifting text while the session restores', async () => {
    let restore: (value: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>((resolve) => (restore = resolve))),
    );

    await render('/library');

    const placeholder = container.querySelector('[role="status"][aria-busy="true"]');
    expect(placeholder?.getAttribute('aria-label')).toBe('Loading your session');
    expect(container.textContent).not.toContain('Loading your session…');
    await act(async () => restore(new Response(null, { status: 401 })));
  });

  it('searches every category from the home form, which has no category selector', async () => {
    await render('/');

    const form = container.querySelector('form[role="search"]');
    expect(form).not.toBeNull();
    expect(form?.querySelector('select')).toBeNull();
    expect(form?.getAttribute('action')).toBeNull();
  });

  it('shows one row per category on the search page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) =>
        Promise.resolve(
          String(input).includes('/catalog/')
            ? new Response(
                JSON.stringify({ page: 1, totalPages: 1, totalResults: 0, results: [], attribution: 'Test' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
              )
            : new Response(null, { status: 401 }),
        ),
      ),
    );

    await render('/search?q=zelda');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(container.textContent).toContain('Results for “zelda”');
    for (const label of ['Movies', 'TV', 'Anime', 'Manga', 'Manhwa', 'Games']) {
      expect(container.querySelector('h2')?.textContent).toBeDefined();
      expect([...container.querySelectorAll('h2')].map((heading) => heading.textContent)).toContain(label);
    }
    expect(container.textContent).toContain('No matches.');
  });
});
