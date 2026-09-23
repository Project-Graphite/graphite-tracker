import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { ConnectorCacheService } from '../src/sources/connector-cache.service';

describe('ConnectorCacheService', () => {
  it('coalesces concurrent loads and writes the result once', async () => {
    const service = new ConnectorCacheService(new ConfigService());
    const internals = service as unknown as {
      read<T>(key: string): Promise<T | undefined>;
      write<T>(key: string, value: T, staleSeconds: number): Promise<void>;
    };
    vi.spyOn(internals, 'read').mockResolvedValue(undefined);
    const write = vi.spyOn(internals, 'write').mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue({ results: ['one'] });

    const [first, second] = await Promise.all([
      service.getOrLoad('key', 60, 300, load),
      service.getOrLoad('key', 60, 300, load),
    ]);

    expect(first).toEqual({ value: { results: ['one'] }, stale: false });
    expect(second).toEqual(first);
    expect(load).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('returns a stale value when a connector load fails', async () => {
    const service = new ConnectorCacheService(new ConfigService());
    const internals = service as unknown as {
      read<T>(key: string): Promise<T | undefined>;
    };
    vi.spyOn(internals, 'read').mockResolvedValue({
      fetchedAt: Date.now() - 120_000,
      value: { results: ['cached'] },
    });

    await expect(
      service.getOrLoad('key', 60, 300, () =>
        Promise.reject(new Error('source unavailable')),
      ),
    ).resolves.toEqual({
      value: { results: ['cached'] },
      stale: true,
    });
  });
});
