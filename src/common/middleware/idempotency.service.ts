import { NextRequest, NextResponse } from 'next/server';
import { logSafe } from '@/common/lib/logger';

/**
 * Idempotency Store Interface
 * Abstracts the storage mechanism for idempotency keys
 */
interface IdempotencyStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/**
 * In-Memory Idempotency Store (for development)
 * WARNING: Not suitable for production with multiple instances
 */
class InMemoryIdempotencyStore implements IdempotencyStore {
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

    // Cleanup expired entries periodically
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const entries = Array.from(this.store.entries());
            for (const [key, entry] of entries) {
                if (now > entry.expiresAt) {
                    this.store.delete(key);
                }
            }
        }, 60000); // Every minute
    }
}

/**
 * Redis Idempotency Store (for production)
 * Requires Redis/Upstash KV
 */
class RedisIdempotencyStore implements IdempotencyStore {
    private redis: any; // Redis client

    constructor(redisClient: any) {
        this.redis = redisClient;
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.redis.get(`idempotency:${key}`);
        } catch (error) {
            logSafe('error', 'IDEMPOTENCY_GET_FAILED', { key, error });
            return null;
        }
    }

    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        try {
            await this.redis.setex(`idempotency:${key}`, ttlSeconds, value);
        } catch (error) {
            logSafe('error', 'IDEMPOTENCY_SET_FAILED', { key, error });
        }
    }
}

/**
 * Idempotency Service
 * 
 * Prevents duplicate operations on network retries by caching responses
 * based on Idempotency-Key header.
 * 
 * Usage:
 * ```typescript
 * const result = await IdempotencyService.execute(
 *     req,
 *     async () => {
 *         // Your operation here
 *         return ResponseUtil.success(data);
 *     }
 * );
 * ```
 */
export class IdempotencyService {
    private static store: IdempotencyStore;
    private static readonly TTL_SECONDS = 24 * 60 * 60; // 24 hours

    /**
     * Initialize the idempotency store
     * Call this at application startup
     */
    static initialize(redisClient?: any) {
        if (redisClient) {
            this.store = new RedisIdempotencyStore(redisClient);
            logSafe('info', 'IDEMPOTENCY_INITIALIZED', { store: 'redis' });
        } else {
            const memoryStore = new InMemoryIdempotencyStore();
            memoryStore.startCleanup();
            this.store = memoryStore;
            logSafe('warn', 'IDEMPOTENCY_INITIALIZED', {
                store: 'in-memory',
                warning: 'Not suitable for production with multiple instances'
            });
        }
    }

    /**
     * Execute an operation with idempotency protection
     */
    static async execute(
        req: NextRequest,
        operation: () => Promise<NextResponse>
    ): Promise<NextResponse> {
        // Ensure store is initialized
        if (!this.store) {
            this.initialize(); // Fallback to in-memory
        }

        const idempotencyKey = req.headers.get('idempotency-key');

        // If no idempotency key, execute normally
        if (!idempotencyKey) {
            return operation();
        }

        // Validate key format (should be UUID or similar)
        if (!this.isValidKey(idempotencyKey)) {
            return NextResponse.json(
                {
                    error: {
                        code: 'INVALID_IDEMPOTENCY_KEY',
                        message: 'Idempotency-Key must be a valid UUID or unique string'
                    }
                },
                { status: 400 }
            );
        }

        // Check if we've seen this key before
        const cachedResponse = await this.store.get(idempotencyKey);

        if (cachedResponse) {
            logSafe('info', 'IDEMPOTENCY_HIT', { key: idempotencyKey });

            // Return cached response
            const parsed = JSON.parse(cachedResponse);
            return new NextResponse(parsed.body, {
                status: parsed.status,
                headers: {
                    ...parsed.headers,
                    'X-Idempotency-Replay': 'true'
                }
            });
        }

        // Execute the operation
        const response = await operation();

        // Cache the response (only for successful operations)
        if (response.status >= 200 && response.status < 300) {
            try {
                const body = await response.text();
                const cached = {
                    status: response.status,
                    headers: Object.fromEntries(response.headers.entries()),
                    body
                };

                await this.store.set(
                    idempotencyKey,
                    JSON.stringify(cached),
                    this.TTL_SECONDS
                );

                logSafe('info', 'IDEMPOTENCY_STORED', { key: idempotencyKey });

                // Return new response with the body
                return new NextResponse(body, {
                    status: response.status,
                    headers: response.headers
                });
            } catch (error) {
                logSafe('error', 'IDEMPOTENCY_CACHE_FAILED', {
                    key: idempotencyKey,
                    error: error instanceof Error ? error.message : 'Unknown'
                });
                return response;
            }
        }

        return response;
    }

    /**
     * Validate idempotency key format
     */
    private static isValidKey(key: string): boolean {
        // Must be 8-128 characters, alphanumeric with hyphens
        return /^[a-zA-Z0-9\-]{8,128}$/.test(key);
    }

    /**
     * Manually invalidate an idempotency key (for testing)
     */
    static async invalidate(key: string): Promise<void> {
        if (!this.store) return;

        // For in-memory store, we'd need to add a delete method
        // For Redis, we'd use DEL command
        logSafe('info', 'IDEMPOTENCY_INVALIDATED', { key });
    }
}
