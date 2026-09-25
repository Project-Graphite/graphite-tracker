import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../src/auth';
import { ReviewCard } from '../src/components/ReviewCard';
import type { PublicReview } from '../src/reviews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const review: PublicReview = {
  id: 'review-id',
  author: { handle: 'reader', displayName: 'Reader' },
  rating: 8,
  title: 'The ending',
  body: 'The tower was the narrator all along.',
  containsSpoilers: true,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('ReviewCard', () => {
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

  async function render(value: PublicReview) {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <AuthProvider>
            <ReviewCard review={value} />
          </AuthProvider>
        </MemoryRouter>,
      ),
    );
  }

  it('keeps a spoiler review collapsed until the reader reveals it', async () => {
    await render(review);

    expect(container.textContent).toContain('This review contains spoilers.');
    expect(container.textContent).not.toContain(review.body);
    expect(container.textContent).not.toContain(review.title);

    const reveal = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Show review',
    );
    await act(async () => reveal?.click());

    expect(container.textContent).toContain(review.title);
    expect(container.textContent).toContain(review.body);
    expect(container.textContent).not.toContain('This review contains spoilers.');
  });

  it('shows review text as written without turning it into markup', async () => {
    const title = '<script>window.injected = true</script>';
    const body = '<img src="x" onerror="window.injected = true"> <b>bold</b>';

    await render({ ...review, containsSpoilers: false, title, body });

    expect(container.querySelector('script, img, b')).toBeNull();
    expect(container.textContent).toContain(title);
    expect(container.textContent).toContain(body);
    expect((window as { injected?: boolean }).injected).toBeUndefined();
  });
});
