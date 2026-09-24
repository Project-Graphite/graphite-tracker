import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface CacheEnvelope<T> {
  fetchedAt: number;
  value: T;
}

@Injectable()
export class ConnectorCacheService {
  private readonly memory = new Map<string, CacheEnvelope<unknown>>();
  private readonly loads = new Map<string, Promise<unknown>>();

  constructor(private readonly redis: RedisService) {}

  async getOrLoad<T>(
    key: string,
    freshSeconds: number,
    staleSeconds: number,
    load: () => Promise<T>,
  ): Promise<{ value: T; stale: boolean }> {
    const cached = await this.read<T>(key);
    if (cached && Date.now() - cached.fetchedAt < freshSeconds * 1000) {
      return { value: cached.value, stale: false };
    }
    try {
      let pending = this.loads.get(key) as Promise<T> | undefined;
      if (!pending) {
        pending = load().then(async (value) => {
          await this.write(key, { fetchedAt: Date.now(), value }, staleSeconds);
          return value;
        });
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
