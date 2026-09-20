import { useState } from 'react';

export function ExpandableText({ children }: { children: string }) {
  const [expanded, setExpanded] = useState(false);
  const expandable = children.length > 160;

  return (
    <div>
      <p className={`mt-0 mb-0 text-sm text-muted ${expanded ? '' : 'line-clamp-3'}`}>
        {children}
      </p>
      {expandable && (
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
