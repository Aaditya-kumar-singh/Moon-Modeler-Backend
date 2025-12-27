# Idempotency & Rate Limiting

## 🔄 Idempotency

### Overview

Idempotency prevents duplicate operations when clients retry requests due to network issues. If the same `Idempotency-Key` is seen within 24 hours, the cached response is returned without re-executing the operation.

### Implementation

**Service**: `src/common/middleware/idempotency.service.ts`

**Storage Options**:
- **Development**: In-memory store (single instance only)
- **Production**: Redis/Upstash KV (multi-instance safe)

### Usage

#### In Controllers

```typescript
import { IdempotencyService } from '@/common/middleware/idempotency.service';

static async create(req: NextRequest) {
    return IdempotencyService.execute(req, async () => {
        // Your operation here
        const result = await service.createResource(data);
        return ResponseUtil.success(result, 201);
    });
}
```

#### Client-Side

```typescript
// Generate unique key (UUID recommended)
const idempotencyKey = crypto.randomUUID();

fetch('/api/v1/projects', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(data)
});

// If network fails and you retry with same key:
// - First request: Executes operation, caches response
// - Retry request: Returns cached response (no re-execution)
```

### Response Headers

**First Request**:
```
HTTP/1.1 201 Created
Content-Type: application/json
```

**Replayed Request**:
```
HTTP/1.1 201 Created
Content-Type: application/json
X-Idempotency-Replay: true
```

### Key Requirements

- **Format**: 8-128 characters, alphanumeric with hyphens
- **Examples**: 
  - ✅ `550e8400-e29b-41d4-a716-446655440000` (UUID)
  - ✅ `my-unique-key-12345`
  - ❌ `abc` (too short)
  - ❌ `key with spaces` (invalid characters)

### Cache Duration

- **TTL**: 24 hours
- **Cleanup**: Automatic (every 60 seconds)

### Production Setup

```typescript
// Initialize with Redis (in app startup)
import { createClient } from 'redis';
import { IdempotencyService } from '@/common/middleware/idempotency.service';

const redis = createClient({
    url: process.env.REDIS_URL
});

await redis.connect();
IdempotencyService.initialize(redis);
```

---

## 🚦 Rate Limiting

### Overview

Rate limiting prevents API abuse using token bucket algorithm. Different endpoints have different limits based on resource intensity.

### Implementation

**Service**: `src/common/middleware/rate-limit.service.ts`

**Storage Options**:
- **Development**: In-memory counters
- **Production**: Redis (recommended for multi-instance)

### Predefined Limits

| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| **Auth** | 5 requests | 15 minutes | Prevent brute force |
| **Import** | 10 requests | 1 hour | SSH/DB resource protection |
| **Save** | 60 requests | 1 minute | Allow auto-save, prevent spam |
| **General** | 100 requests | 1 minute | Default API protection |

### Usage

#### In Controllers

```typescript
import { RateLimitService, RateLimitPresets } from '@/common/middleware/rate-limit.service';

static async importMysql(req: NextRequest) {
    return RateLimitService.middleware(req, RateLimitPresets.IMPORT, async () => {
        // Your operation here
        const result = await importService.execute(config);
        return ResponseUtil.success(result);
    });
}
```

#### Custom Limits

```typescript
const customLimit = {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: (req) => getUserId(req) // Rate limit per user
};

return RateLimitService.middleware(req, customLimit, async () => {
    // Your operation
});
```

### Response on Rate Limit

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Limit: 10 requests per 3600 seconds."
  }
}
```

**Headers**:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
```

### Identifier Strategy

By default, rate limits are applied per IP address:

```typescript
// Automatically extracts from headers:
// 1. x-forwarded-for (Vercel, Cloudflare)
// 2. x-real-ip
// 3. Fallback: 'unknown'
```

For authenticated endpoints, use custom identifier:

```typescript
{
    maxRequests: 60,
    windowSeconds: 60,
    identifier: (req) => {
        const userId = getUserId(req);
        return `user:${userId}`;
    }
}
```

### Production Setup

```typescript
// Initialize with Redis
import { RateLimitService } from '@/common/middleware/rate-limit.service';

const redis = createClient({
    url: process.env.REDIS_URL
});

await redis.connect();
RateLimitService.initialize(redis);
```

---

## 🏗️ Architecture

### In-Memory Store (Development)

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Rate Limiter   │
│  (In-Memory)    │
│                 │
│  Map<key, {     │
│    count: 5,    │
│    resetAt: ts  │
│  }>             │
└─────────────────┘
```

**Limitations**:
- ❌ Not shared across instances
- ❌ Lost on restart
- ✅ Good for development
- ✅ No external dependencies

### Redis Store (Production)

```
┌─────────────┐     ┌─────────────┐
│  Instance 1 │────▶│             │
└─────────────┘     │             │
                    │    Redis    │
┌─────────────┐     │   (Shared)  │
│  Instance 2 │────▶│             │
└─────────────┘     │             │
                    └─────────────┘
```

**Benefits**:
- ✅ Shared across all instances
- ✅ Persistent (survives restarts)
- ✅ Production-ready
- ✅ Atomic operations

---

## 📊 Monitoring

### Idempotency Logs

```typescript
// Cache hit (replay)
{
  level: 'info',
  message: 'IDEMPOTENCY_HIT',
  key: '550e8400-e29b-41d4-a716-446655440000'
}

// Cache stored
{
  level: 'info',
  message: 'IDEMPOTENCY_STORED',
  key: '550e8400-e29b-41d4-a716-446655440000'
}
```

### Rate Limit Logs

```typescript
// Rate limit exceeded
{
  level: 'warn',
  message: 'RATE_LIMIT_EXCEEDED',
  identifier: '192.168.1.1',
  count: 11,
  limit: 10,
  window: 3600
}
```

---

## 🧪 Testing

### Testing Idempotency

```typescript
// Test idempotent create
const key = crypto.randomUUID();

// First request
const response1 = await fetch('/api/v1/projects', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ name: 'Test' })
});
expect(response1.status).toBe(201);
expect(response1.headers.get('X-Idempotency-Replay')).toBeNull();

// Retry with same key
const response2 = await fetch('/api/v1/projects', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ name: 'Test' })
});
expect(response2.status).toBe(201);
expect(response2.headers.get('X-Idempotency-Replay')).toBe('true');

// Verify only one project was created
const projects = await db.project.findMany({ where: { name: 'Test' } });
expect(projects).toHaveLength(1);
```

### Testing Rate Limits

```typescript
// Test rate limit enforcement
const requests = [];

for (let i = 0; i < 12; i++) {
    requests.push(
        fetch('/api/v1/import/mysql', {
            method: 'POST',
            body: JSON.stringify(config)
        })
    );
}

const responses = await Promise.all(requests);

// First 10 should succeed
expect(responses.slice(0, 10).every(r => r.status === 200)).toBe(true);

// 11th and 12th should be rate limited
expect(responses[10].status).toBe(429);
expect(responses[11].status).toBe(429);
```

---

## 🚀 Deployment Checklist

### Development
- [x] In-memory stores initialized
- [x] Idempotency working locally
- [x] Rate limits enforced

### Production
- [ ] Redis/Upstash KV provisioned
- [ ] Connection string in environment variables
- [ ] Services initialized with Redis client
- [ ] Monitoring/alerts configured
- [ ] Rate limit thresholds reviewed
- [ ] Idempotency key generation documented for clients

---

## 🔧 Configuration

### Environment Variables

```env
# Redis (for production)
REDIS_URL="redis://user:password@host:port"

# Or Upstash (serverless Redis)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

### Initialization (app startup)

```typescript
// src/app/layout.tsx or middleware
import { IdempotencyService } from '@/common/middleware/idempotency.service';
import { RateLimitService } from '@/common/middleware/rate-limit.service';

// Development (in-memory)
IdempotencyService.initialize();
RateLimitService.initialize();

// Production (Redis)
if (process.env.REDIS_URL) {
    const redis = createClient({ url: process.env.REDIS_URL });
    await redis.connect();
    
    IdempotencyService.initialize(redis);
    RateLimitService.initialize(redis);
}
```

---

## 📚 Best Practices

### Idempotency

1. **Always use for mutating operations** (POST, PATCH, DELETE)
2. **Generate keys client-side** (UUID v4 recommended)
3. **Store keys** for retry logic
4. **Don't reuse keys** across different operations
5. **Handle 400 errors** for invalid keys

### Rate Limiting

1. **Apply to all public endpoints**
2. **Use stricter limits for expensive operations**
3. **Provide clear error messages**
4. **Include Retry-After header**
5. **Monitor for abuse patterns**
6. **Adjust limits based on usage data**

---

## ⚠️ Known Limitations

### In-Memory Stores

- Not suitable for production with multiple instances
- Data lost on restart
- No cross-instance synchronization

### Redis Dependency

- Requires external service
- Additional cost
- Network latency
- Single point of failure (use Redis Cluster for HA)

### Idempotency Edge Cases

- Only caches successful responses (2xx)
- 24-hour TTL may be too short for some use cases
- Large responses consume memory/storage
