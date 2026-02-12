import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ICacheService } from 'src/core/abstracts';

type CacheEntry = {
  value: string;
  expiresAt: number | null;
};

@Injectable()
export class RedisCacheService implements ICacheService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly inMemoryCache = new Map<string, CacheEntry>();
  private keyPrefix = 'myfuel:cache:';
  private redisClient: {
    connect: () => Promise<void>;
    quit: () => Promise<void>;
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<unknown>;
    setEx: (key: string, ttlSeconds: number, value: string) => Promise<unknown>;
    del: (key: string) => Promise<unknown>;
    on: (event: string, listener: (error: unknown) => void) => void;
  } | null = null;
  private isRedisReady = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.keyPrefix = this.normalizePrefix(
      this.configService.get<string>('redis.keyPrefix')?.trim() ?? this.keyPrefix
    );

    const redisUrl = this.configService.get<string>('redis.url')?.trim() ?? '';
    if (!redisUrl) {
      return;
    }

    try {
      const redisDb = this.normalizeDb(this.configService.get<number>('redis.db'));
      const dynamicImport = new Function(
        'specifier',
        'return import(specifier)'
      ) as (specifier: string) => Promise<{
        createClient: (options: { url: string; database?: number }) => RedisCacheService['redisClient'];
      }>;
      const redisModule = await dynamicImport('redis');
      const client = redisModule.createClient({ url: redisUrl, database: redisDb });
      if (!client) {
        return;
      }

      client.on('error', (error: unknown) => {
        this.logger.warn(`Redis error: ${String(error)}`);
      });
      await client.connect();
      this.redisClient = client;
      this.isRedisReady = true;
      this.logger.log('Redis cache connected');
    } catch (error) {
      this.logger.warn(`Redis cache disabled, fallback to in-memory cache: ${String(error)}`);
      this.redisClient = null;
      this.isRedisReady = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.redisClient || !this.isRedisReady) {
      return;
    }

    try {
      await this.redisClient.quit();
    } catch {
      return;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.withPrefix(key);
    const redisValue = await this.getFromRedis(prefixedKey);
    if (redisValue !== null) {
      return this.deserialize<T>(redisValue);
    }

    const local = this.inMemoryCache.get(prefixedKey);
    if (!local) {
      return null;
    }

    if (local.expiresAt !== null && local.expiresAt <= Date.now()) {
      this.inMemoryCache.delete(prefixedKey);
      return null;
    }

    return this.deserialize<T>(local.value);
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    const prefixedKey = this.withPrefix(key);
    const serialized = JSON.stringify(value);
    await this.setToRedis(prefixedKey, serialized, ttlSeconds);

    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.inMemoryCache.set(prefixedKey, { value: serialized, expiresAt });
  }

  async del(key: string): Promise<void> {
    const prefixedKey = this.withPrefix(key);
    this.inMemoryCache.delete(prefixedKey);
    if (!this.redisClient || !this.isRedisReady) {
      return;
    }

    try {
      await this.redisClient.del(prefixedKey);
    } catch {
      return;
    }
  }

  private withPrefix(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private normalizePrefix(prefix: string): string {
    if (!prefix) {
      return 'myfuel:cache:';
    }

    return prefix.endsWith(':') ? prefix : `${prefix}:`;
  }

  private normalizeDb(db: number | undefined): number {
    if (typeof db !== 'number' || Number.isNaN(db)) {
      return 0;
    }

    if (db < 0) {
      return 0;
    }

    return Math.trunc(db);
  }

  private async getFromRedis(key: string): Promise<string | null> {
    if (!this.redisClient || !this.isRedisReady) {
      return null;
    }

    try {
      return await this.redisClient.get(key);
    } catch {
      return null;
    }
  }

  private async setToRedis(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.redisClient || !this.isRedisReady) {
      return;
    }

    try {
      if (ttlSeconds > 0) {
        await this.redisClient.setEx(key, ttlSeconds, value);
        return;
      }

      await this.redisClient.set(key, value);
    } catch {
      return;
    }
  }

  private deserialize<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
}
