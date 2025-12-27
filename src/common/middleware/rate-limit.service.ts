import { NextRequest, NextResponse } from 'next/server';
import { logSafe } from '@/common/lib/logger';

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
    maxRequests: number;
    windowSeconds: number;
    identifier?: (req: NextRequest) => string; // Custom identifier function
}

/**
 * Rate Limit Store Interface
 */
interface RateLimitStore {
    increment(key: string, windowSeconds: number): Promise<number>;
    reset(key: string): Promise<void>;
}

/**
 * In-Memory Rate Limit Store (for development)
 */
class InMemoryRateLimitStore implements RateLimitStore {
    private store = new Map<string, { count: number; resetAt: number }>();

    async increment(key: string, windowSeconds: number): Promise<number> {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || now > entry.resetAt) {
            // New window
            this.store.set(key, {
                count: 1,
                resetAt: now + (windowSeconds * 1000)
            });
            return 1;
        }

        // Increment existing window
        entry.count++;
        return entry.count;
    }

    async reset(key: string): Promise<void> {
        this.store.delete(key);
    }

    // Cleanup expired entries
    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const entries = Array.from(this.store.entries());
            for (const [key, entry] of entries) {
                if (now > entry.resetAt) {
                    this.store.delete(key);
                }
            }
        }, 60000); // Every minute
    }
}

/**
 * Redis Rate Limit Store (for production)
 */
class RedisRateLimitStore implements RateLimitStore {
    private redis: any;

    constructor(redisClient: any) {
        this.redis = redisClient;
    }

    async increment(key: string, windowSeconds: number): Promise<number> {
        try {
            const redisKey = `ratelimit:${key}`;
            const count = await this.redis.incr(redisKey);

            if (count === 1) {
                // First request in window, set expiry
                await this.redis.expire(redisKey, windowSeconds);
            }

            return count;
        } catch (error) {
            logSafe('error', 'RATELIMIT_INCREMENT_FAILED', { key, error });
            return 0; // Fail open (allow request)
        }
    }

    async reset(key: string): Promise<void> {
        try {
            await this.redis.del(`ratelimit:${key}`);
        } catch (error) {
            logSafe('error', 'RATELIMIT_RESET_FAILED', { key, error });
        }
    }
}

/**
 * Rate Limiting Service
 * 
 * Implements token bucket algorithm to prevent API abuse.
 * 
 * Predefined limits:
 * - Auth: 5 requests / 15 minutes
 * - Import: 10 requests / hour
 * - Save: 60 requests / minute
 * 
 * Usage:
 * ```typescript
 * const allowed = await RateLimitService.check(req, RateLimitPresets.AUTH);
 * if (!allowed) {
 *     return ResponseUtil.error('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
 * }
 * ```
 */
export class RateLimitService {
    private static store: RateLimitStore;

    /**
     * Initialize the rate limit store
     */
    static initialize(redisClient?: any) {
        if (redisClient) {
            this.store = new RedisRateLimitStore(redisClient);
            logSafe('info', 'RATELIMIT_INITIALIZED', { store: 'redis' });
        } else {
            const memoryStore = new InMemoryRateLimitStore();
            memoryStore.startCleanup();
            this.store = memoryStore;
            logSafe('warn', 'RATELIMIT_INITIALIZED', {
                store: 'in-memory',
                warning: 'Not suitable for production with multiple instances'
            });
        }
    }

    /**
     * Check if request is within rate limit
     * Returns true if allowed, false if rate limited
     */
    static async check(
        req: NextRequest,
        config: RateLimitConfig
    ): Promise<boolean> {
        // Ensure store is initialized
        if (!this.store) {
            this.initialize();
        }

        // Get identifier (IP address or custom)
        const identifier = config.identifier
            ? config.identifier(req)
            : this.getClientIdentifier(req);

        const key = `${identifier}:${config.windowSeconds}`;

        // Increment counter
        const count = await this.store.increment(key, config.windowSeconds);

        const allowed = count <= config.maxRequests;

        if (!allowed) {
            logSafe('warn', 'RATE_LIMIT_EXCEEDED', {
                identifier,
                count,
                limit: config.maxRequests,
                window: config.windowSeconds
            });
        }

        return allowed;
    }

    /**
     * Middleware wrapper for rate limiting
     * Returns NextResponse with 429 if rate limited
     */
    static async middleware(
        req: NextRequest,
        config: RateLimitConfig,
        next: () => Promise<NextResponse>
    ): Promise<NextResponse> {
        const allowed = await this.check(req, config);

        if (!allowed) {
            return NextResponse.json(
                {
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: `Too many requests. Limit: ${config.maxRequests} requests per ${config.windowSeconds} seconds.`
                    }
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': config.windowSeconds.toString(),
                        'X-RateLimit-Limit': config.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0'
                    }
                }
            );
        }

        return next();
    }

    /**
     * Get client identifier (IP address or user ID)
     */
    private static getClientIdentifier(req: NextRequest): string {
        // Try to get user ID from auth (if available)
        // For now, use IP address

        // Vercel/Cloudflare headers
        const forwardedFor = req.headers.get('x-forwarded-for');
        const realIp = req.headers.get('x-real-ip');

        if (forwardedFor) {
            return forwardedFor.split(',')[0].trim();
        }

        if (realIp) {
            return realIp;
        }

        // Fallback
        return 'unknown';
    }

    /**
     * Reset rate limit for a specific identifier (for testing)
     */
    static async reset(identifier: string, windowSeconds: number): Promise<void> {
        if (!this.store) return;
        await this.store.reset(`${identifier}:${windowSeconds}`);
    }
}

/**
 * Predefined Rate Limit Configurations
 */
export const RateLimitPresets = {
    /**
     * Auth endpoints: 5 requests / 15 minutes
     * Prevents brute force attacks
     */
    AUTH: {
        maxRequests: 5,
        windowSeconds: 15 * 60, // 15 minutes
    } as RateLimitConfig,

    /**
     * Import endpoints: 10 requests / hour
     * Prevents SSH/DB resource exhaustion
     */
    IMPORT: {
        maxRequests: 10,
        windowSeconds: 60 * 60, // 1 hour
    } as RateLimitConfig,

    /**
     * Save endpoints: 60 requests / minute (per user)
     * Allows auto-save while preventing abuse
     */
    SAVE: {
        maxRequests: 60,
        windowSeconds: 60, // 1 minute
    } as RateLimitConfig,

    /**
     * General API: 100 requests / minute
     */
    GENERAL: {
        maxRequests: 100,
        windowSeconds: 60,
    } as RateLimitConfig,
};
