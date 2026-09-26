import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const user = {
  id: 'user-1',
  email: 'reader@example.com',
  handle: 'reader',
  displayName: 'Reader One',
  role: 'member',
  showAdultContent: false,
  blurAdultContent: true,
};

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="path">{location.pathname}</output>;
}

describe('Settings inside the profile', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) return Promise.resolve(json({ accessToken: 'token', user }));
        if (url.endsWith('/me/notification-preferences')) {
          return Promise.resolve(
            json({ enabled: false, categories: ['movie'], cadence: 'daily', suspended: false }),
          );
        }
        if (url.includes('/me/inbox/summary')) {
          return Promise.resolve(json({ unread: 0, latestAt: null, fresh: [] }));
        }
        if (url.endsWith('/users/reader')) {
          return Promise.resolve(json({ handle: 'reader', displayName: 'Reader One', isPublic: false }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
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

  async function render(path: string) {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
            <CurrentPath />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
  }

  it('sends old settings links to the settings tab of the reader’s profile', async () => {
    await render('/settings/notifications');

    expect(container.querySelector('[data-testid="path"]')?.textContent).toBe(
      '/users/reader/settings/notifications',
    );
    expect(container.querySelector('h1')?.textContent).toBe('Reader One');
    expect(container.textContent).toContain('Release emails');
    expect(
      [...container.querySelectorAll('nav[aria-label="Your profile"] a')].map((link) => link.textContent),
    ).toEqual(['Profile', 'Settings']);
  });

  it('keeps settings out of the main navigation and offers them on the reader’s own profile', async () => {
    await render('/users/reader');

    const primary = container.querySelector('nav[aria-label="Primary"]');
    expect(primary?.textContent).not.toContain('settings');
    expect(
      container.querySelector('nav[aria-label="Your profile"] a[href="/users/reader/settings"]'),
    ).not.toBeNull();
  });
});
