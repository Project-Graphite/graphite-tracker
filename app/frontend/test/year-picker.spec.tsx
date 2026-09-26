import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { YearPicker } from '../src/components/YearPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('YearPicker', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <form>
          <YearPicker defaultValue="" label="Year" name="year" />
        </form>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const trigger = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
  const submitted = () => new FormData(container.querySelector('form')!).get('year');

  it('picks a year from the list and submits it with the form', async () => {
    expect(trigger().textContent).toBe('Any year');
    await act(async () => trigger().click());

    const options = [...container.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options[0]?.textContent).toBe('Any year');
    expect(options.map((option) => option.textContent)).toContain('1999');
    await act(async () => options.find((option) => option.textContent === '1999')!.click());

    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger().textContent).toBe('1999');
    expect(submitted()).toBe('1999');
  });

  it('closes with Escape and returns focus to the field', async () => {
    await act(async () => trigger().click());
    const listbox = container.querySelector('[role="listbox"]')!;

    await act(async () =>
      listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
    );

    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(submitted()).toBe('');
  });
});
