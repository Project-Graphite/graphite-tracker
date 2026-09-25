import { ReleaseSignal } from './source.types';

export const today = () => new Date().toISOString().slice(0, 10);

export function platformReleaseSignals(
  releaseDates: Array<{ date: string; platform: string | null }>,
): ReleaseSignal[] {
  const earliest = new Map<string, string>();
  for (const { date, platform } of releaseDates) {
    const current = platform && earliest.get(platform);
    if (platform && (!current || date < current)) {
      earliest.set(platform, date);
    }
  }
  const now = today();
  return [...earliest].map(([platform, date]) =>
    date <= now
      ? { key: `release:${platform}`, kind: 'release', label: `Out now on ${platform}`, platform, occurredAt: date }
      : {
          key: `date:${platform}:${date}`,
          kind: 'release_date',
          label: `${platform} release set for ${date}`,
          platform,
          occurredAt: date,
        },
  );
}
