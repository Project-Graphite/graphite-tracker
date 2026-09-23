import { useLayoutEffect, useRef, useState } from 'react';

export function ExpandableText({ children }: { children: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const element = text.current;
    if (!element || expanded) return;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children, expanded]);

  return (
    <div>
      <p className={`mt-0 mb-0 text-sm text-muted ${expanded ? '' : 'line-clamp-3'}`} ref={text}>
        {children}
      </p>
      {(overflowing || expanded) && (
        <button
          aria-expanded={expanded}
          className="text-button mono-sm mt-2"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
