import type { Attribution as SourceAttribution } from '../catalog';

export function Attribution({ source }: { source: SourceAttribution }) {
  return (
    <span className="mono-sm text-faint">
      Data:{' '}
      {source.attributionUrl ? (
        <a className="rule-link" href={source.attributionUrl} rel="noreferrer" target="_blank">
          {source.attribution}
        </a>
      ) : (
        source.attribution
      )}
    </span>
  );
}
