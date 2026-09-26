import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const session = {
  accessToken: 'token',
  user: {
    id: 'user-1',
    email: 'reader@example.com',
    handle: 'reader',
    displayName: 'Reader',
    role: 'member',
    showAdultContent: false,
    blurAdultContent: true,
  },
};

const release = {
  id: 'note-2',
  release: 'Chapter 121',
  read: false,
  createdAt: '2026-09-27T10:00:00.000Z',
  item: {
    id: 'item-1',
    category: 'manga',
    title: 'Tower Story',
    posterUrl: null,
    releaseDate: null,
    source: 'mangadex',
    externalId: 'md-1',
    adult: false,
  },
};

describe('Notification center', () => {
  let container: HTMLDivElement;
  let root: Root;
  let summaries: string[];

  beforeEach(() => {
    summaries = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) return Promise.resolve(json(session));
        if (url.includes('/me/inbox/summary')) {
          summaries.push(url);
          return Promise.resolve(
            json(
              url.includes('since=')
                ? { unread: 2, latestAt: release.createdAt, fresh: [release] }
                : { unread: 1, latestAt: '2026-09-27T09:00:00.000Z', fresh: [] },
            ),
          );
        }
        return Promise.resolve(
          json({ page: 1, totalPages: 1, totalResults: 0, results: [], attribution: 'Test' }),
        );
      }),
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 30)));

  it('counts unread releases and pops up the ones that arrive while browsing', async () => {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
    await settle();

    const bell = () => container.querySelector('button[aria-haspopup="dialog"]');
    expect(bell()?.getAttribute('aria-label')).toBe('Notifications, 1 unread');
    expect(document.querySelector('.snackbar')).toBeNull();

    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await settle();

    expect(summaries.at(-1)).toContain(`since=${encodeURIComponent('2026-09-27T09:00:00.000Z')}`);
    expect(bell()?.getAttribute('aria-label')).toBe('Notifications, 2 unread');
    const snackbar = document.querySelector('.snackbar');
    expect(snackbar?.textContent).toContain('Tower Story');
    expect(snackbar?.textContent).toContain('Chapter 121');
    expect(snackbar?.querySelector('a')?.getAttribute('href')).toBe('/titles/manga/md-1?source=mangadex');
  });
});
