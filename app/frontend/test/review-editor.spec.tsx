import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/auth';
import { ReviewEditor } from '../src/components/ReviewEditor';
import type { OwnReview } from '../src/reviews';

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

describe('ReviewEditor', () => {
  let container: HTMLDivElement;
  let root: Root;
  let saved: Array<Record<string, unknown>>;

  beforeEach(() => {
    saved = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string, init?: RequestInit) => {
        if (String(input).endsWith('/auth/refresh')) return Promise.resolve(json(session));
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        saved.push(body);
        return Promise.resolve(json({ id: 'review-id', ...body }));
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

  async function render(review: OwnReview | null) {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <AuthProvider>
            <ReviewEditor itemId="item-1" onClose={() => undefined} onSaved={() => undefined} review={review} />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
  }

  const privateSwitch = () => container.querySelector<HTMLButtonElement>('button[role="switch"]');
  const save = () =>
    act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

  it('starts public with a Private switch and saves the choice', async () => {
    await render(null);

    expect(container.querySelector('select')).toBeNull();
    expect(privateSwitch()?.getAttribute('aria-checked')).toBe('false');
    expect(container.textContent).toContain('Private');
    expect(container.textContent).not.toMatch(/administrator/i);

    await save();
    expect(saved.at(-1)).toMatchObject({ visibility: 'public' });

    await act(async () => privateSwitch()?.click());
    expect(privateSwitch()?.getAttribute('aria-checked')).toBe('true');
    await save();
    expect(saved.at(-1)).toMatchObject({ visibility: 'private' });
  });

  it('keeps an existing private review private', async () => {
    await render({
      id: 'review-id',
      rating: 6,
      title: null,
      body: null,
      containsSpoilers: false,
      visibility: 'private',
      hidden: false,
    } as OwnReview);

    expect(privateSwitch()?.getAttribute('aria-checked')).toBe('true');
  });
});
