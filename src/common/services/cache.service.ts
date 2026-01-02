
import { logSafe } from '@/common/lib/logger';

/**
 * Cache Interface
 */
interface CacheStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds: number): Promise<void>;
    del(key: string): Promise<void>;
    keys(pattern: string): Promise<string[]>;
}

/**
 * In-Memory Cache (Default/Dev)
 */
class InMemoryCacheStore implements CacheStore {
    private store = new Map<string, { value: string; expiresAt: number }>();

    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return entry.value;
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }

    async del(key: string): Promise<void> {
        this.store.delete(key);
    }

    async keys(pattern: string): Promise<string[]> {
        // Simple regex matching for patterns like "user:*"
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        return Array.from(this.store.keys()).filter(k => regex.test(k));
    }
}

/**
 * Redis Cache Store (Production)
 * Replace `any` with your actual Redis client type
 */
/**
 * Redis Cache Store (Production)
 * Adapter for ioredis
 */
class RedisCacheStore implements CacheStore {
    private redis: any;

    constructor(redisClient: any) {
        this.redis = redisClient;
    }

    async get(key: string): Promise<string | null> {
        return this.redis.get(key);
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        await this.redis.setex(key, ttlSeconds, value);
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async keys(pattern: string): Promise<string[]> {
        return this.redis.keys(pattern);
    }
}

/**
 * Upstash HTTP Cache Store
 * Adapter for @upstash/redis
 */
class UpstashCacheStore implements CacheStore {
    private redis: any;

    constructor(redisClient: any) {
        this.redis = redisClient;
    }

    async get(key: string): Promise<string | null> {
        const val = await this.redis.get(key);
        // Upstash REST returns object if JSON, strict string handling needed?
        // Usually it auto-parses, but our service expects stringified JSON.
        // If it returns object, we assume it's already parsed, but CacheService.get expects string to parse.
        // We'll stringify it back to match the contract or handle it in service.
        // Let's return raw since CacheService.get ignores non-string?
        // Actually CacheService.get does: return val ? JSON.parse(val) : null;
        // If upstash returns object, JSON.parse([object Object]) crashes.
        // BETTER: return plain object and let service handle? No service expects string.
        // FIX: Check type.
        return typeof val === 'object' ? JSON.stringify(val) : val;
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        // Upstash REST: set(key, value, { ex: ttl })
        await this.redis.set(key, value, { ex: ttlSeconds });
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async keys(pattern: string): Promise<string[]> {
        return this.redis.keys(pattern);
    }
}

export class CacheService {
    private static store: CacheStore = new InMemoryCacheStore();
    private static enabled = true;

    static initialize(redisClient?: any) {
        if (redisClient) {
            // Detect if Upstash (has .set(key, val, opts) signature check or constructor name)
            // ioredis has .setex, upstash does not (it uses options)
            if (typeof redisClient.setex === 'function') {
                this.store = new RedisCacheStore(redisClient);
                logSafe('info', 'CACHE_INITIALIZED', { type: 'ioredis' });
            } else {
                this.store = new UpstashCacheStore(redisClient);
                logSafe('info', 'CACHE_INITIALIZED', { type: 'upstash-http' });
            }
        } else {
            this.store = new InMemoryCacheStore();
            logSafe('info', 'CACHE_INITIALIZED', { type: 'memory' });
        }
    }

    static async get<T>(key: string): Promise<T | null> {
        if (!this.enabled) return null;
        try {
            const val = await this.store.get(key);
            return val ? JSON.parse(val) : null;
        } catch (e) {
            return null;
        }
    }

    static async set(key: string, value: any, ttlSeconds: number = 300) {
        if (!this.enabled) return;
        try {
            await this.store.set(key, JSON.stringify(value), ttlSeconds);
        } catch (e) {
            logSafe('error', 'CACHE_SET_ERROR', { key });
        }
    }

    static async del(key: string) {
        if (!this.enabled) return;
        await this.store.del(key);
    }

    static async invalidatePattern(pattern: string) {
        if (!this.enabled) return;
        try {
            const keys = await this.store.keys(pattern);
            for (const key of keys) {
                await this.store.del(key);
            }
        } catch (e) {
            logSafe('error', 'CACHE_INVALIDATE_ERROR', { pattern });
        }
    }
}
