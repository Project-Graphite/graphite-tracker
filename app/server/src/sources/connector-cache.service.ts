import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { withLowPriority } from './connector-http.service';

interface CacheEnvelope<T> {
  fetchedAt: number;
  value: T;
}

@Injectable()
export class ConnectorCacheService {
  private readonly logger = new Logger(ConnectorCacheService.name);
  private readonly memory = new Map<string, CacheEnvelope<unknown>>();
  private readonly loads = new Map<string, Promise<unknown>>();

  constructor(private readonly redis: RedisService) {}

  async getOrLoad<T>(
    key: string,
    freshSeconds: number,
    staleSeconds: number,
    load: () => Promise<T>,
    { refreshInBackground = false } = {},
  ): Promise<{ value: T; stale: boolean }> {
    const cached = await this.read<T>(key);
    if (cached && Date.now() - cached.fetchedAt < freshSeconds * 1000) {
      return { value: cached.value, stale: false };
    }
    if (
      cached &&
      refreshInBackground &&
      Date.now() - cached.fetchedAt < staleSeconds * 1000
    ) {
      if (!this.loads.has(key)) {
        const refresh = this.fetch(key, staleSeconds, () => withLowPriority(load));
        this.loads.set(key, refresh);
        void refresh
          .catch((error: unknown) =>
            this.logger.warn(
              `Refreshing ${key} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
            ),
          )
          .finally(() => this.loads.delete(key));
      }
      return { value: cached.value, stale: false };
    }
    try {
      let pending = this.loads.get(key) as Promise<T> | undefined;
      if (!pending) {
        pending = this.fetch(key, staleSeconds, load);
        this.loads.set(key, pending);
      }
      const value = await pending;
      return { value, stale: false };
    } catch (error) {
      if (cached && Date.now() - cached.fetchedAt < staleSeconds * 1000) {
        return { value: cached.value, stale: true };
      }
      throw error;
    } finally {
      this.loads.delete(key);
    }
  }

  private fetch<T>(key: string, staleSeconds: number, load: () => Promise<T>) {
    return load().then(async (value) => {
      await this.write(key, { fetchedAt: Date.now(), value }, staleSeconds);
      return value;
    });
  }

  private async read<T>(key: string) {
    const stored = await this.redis.run((client) => client.get(key));
    if (stored) {
      const envelope = JSON.parse(stored) as CacheEnvelope<T>;
      this.remember(key, envelope);
      return envelope;
    }
    return this.memory.get(key) as CacheEnvelope<T> | undefined;
  }

  private async write<T>(key: string, envelope: CacheEnvelope<T>, staleSeconds: number) {
    this.remember(key, envelope);
    await this.redis.run((client) =>
      client.set(key, JSON.stringify(envelope), { EX: staleSeconds }),
    );
  }

  private remember(key: string, envelope: CacheEnvelope<unknown>) {
    this.memory.set(key, envelope);
    if (this.memory.size > 500) {
      this.memory.delete(this.memory.keys().next().value as string);
    }
  }
}
