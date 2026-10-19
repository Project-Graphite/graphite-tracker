import MuiLink from '@mui/material/Link';
import type { Attribution as SourceAttribution } from '../catalog';

export function Attribution({ source }: { source: SourceAttribution }) {
  return (
    <span className="mono-sm text-faint">
      Data:{' '}
      {source.attributionUrl ? (
        <MuiLink href={source.attributionUrl} rel="noreferrer" target="_blank" underline="always">
          {source.attribution}
        </MuiLink>
      ) : (
        source.attribution
      )}
    </span>
  );
}
