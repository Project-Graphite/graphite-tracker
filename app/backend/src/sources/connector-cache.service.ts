import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

interface CacheEnvelope<T> {
  fetchedAt: number;
  value: T;
}

@Injectable()
export class ConnectorCacheService implements OnModuleDestroy {
  private client?: RedisClientType;
  private connection?: Promise<RedisClientType | undefined>;
  private readonly memory = new Map<string, CacheEnvelope<unknown>>();

  constructor(private readonly config: ConfigService) {}

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
      const value = await load();
      await this.write(key, { fetchedAt: Date.now(), value }, staleSeconds);
      return { value, stale: false };
    } catch (error) {
      if (cached && Date.now() - cached.fetchedAt < staleSeconds * 1000) {
        return { value: cached.value, stale: true };
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  private async read<T>(key: string) {
    const client = await this.getClient();
    if (client) {
      try {
        const value = await client.get(key);
        if (value) {
          const envelope = JSON.parse(value) as CacheEnvelope<T>;
          this.memory.set(key, envelope);
          return envelope;
        }
      } catch {
        this.client = undefined;
        this.connection = undefined;
      }
    }
    return this.memory.get(key) as CacheEnvelope<T> | undefined;
  }

  private async write<T>(key: string, envelope: CacheEnvelope<T>, staleSeconds: number) {
    this.memory.set(key, envelope);
    const client = await this.getClient();
    if (client) {
      try {
        await client.set(key, JSON.stringify(envelope), { EX: staleSeconds });
      } catch {
        this.client = undefined;
        this.connection = undefined;
      }
    }
  }

  private getClient() {
    if (!this.connection) {
      this.connection = this.connect();
    }
    return this.connection;
  }

  private async connect() {
    try {
      const client = createClient({
        url: this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      });
      client.on('error', () => undefined);
      await client.connect();
      this.client = client as RedisClientType;
      return this.client;
    } catch {
      return undefined;
    }
  }
}
