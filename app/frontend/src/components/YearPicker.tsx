import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

const firstYear = 1870;
const lastYear = new Date().getFullYear() + 2;

const decades = Array.from(
  { length: Math.floor(lastYear / 10) - Math.floor(firstYear / 10) + 1 },
  (_, index) => {
    const start = (Math.floor(lastYear / 10) - index) * 10;
    return {
      label: `${start}s`,
      years: Array.from({ length: 10 }, (_, offset) => start + 9 - offset).filter(
        (year) => year >= firstYear && year <= lastYear,
      ),
    };
  },
);

export function YearPicker({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listbox = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const selected =
      listbox.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      listbox.current?.querySelector<HTMLElement>('[role="option"]');
    const panel = listbox.current;
    if (selected && panel) {
      panel.scrollTop = selected.offsetTop - (panel.clientHeight - selected.offsetHeight) / 2;
      selected.focus({ preventScroll: true });
    }
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function choose(next: string) {
    setValue(next);
    setOpen(false);
    trigger.current?.focus();
  }

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const options = [...(listbox.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const current = options.indexOf(document.activeElement as HTMLElement);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 5, ArrowUp: -5 }[event.key];
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (step !== undefined || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const target =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : Math.min(options.length - 1, Math.max(0, current + (step ?? 0)));
      options[target]?.focus();
    }
  }

  return (
    <div className="field-label" ref={root}>
      <span id={labelId}>{label}</span>
      <div className="relative">
        <input name={name} type="hidden" value={value} />
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          className="select-trigger"
          onClick={() => setOpen((current) => !current)}
          ref={trigger}
          type="button"
        >
          <span className={value ? 'text-ink' : 'text-faint'}>{value || 'Any year'}</span>
          <svg aria-hidden="true" className="chevron" fill="none" height="16" viewBox="0 0 24 24" width="16">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
        {open && (
          <>
            <div aria-hidden="true" className="sheet-backdrop" onClick={() => setOpen(false)} />
            <div
              aria-labelledby={labelId}
              className="popover-panel year-panel"
              onKeyDown={move}
              ref={listbox}
              role="listbox"
            >
              <button
                aria-selected={value === ''}
                className="year-option col-span-5"
                onClick={() => choose('')}
                role="option"
                type="button"
              >
                Any year
              </button>
              {decades.map((decade) => (
                <div className="contents" key={decade.label}>
                  <p className="eyebrow col-span-5 mt-3 mb-1">{decade.label}</p>
                  {decade.years.map((year) => (
                    <button
                      aria-selected={value === String(year)}
                      className="year-option"
                      key={year}
                      onClick={() => choose(String(year))}
                      role="option"
                      type="button"
                    >
                      {year}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
