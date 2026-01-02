const fs = require('fs');
try {
    const envConfig = require('dotenv').parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.error('Failed to manually load .env', e);
}

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { SocketHandler } from './gateway/socket.handler';

import { Redis } from 'ioredis';
import { CacheService } from './common/services/cache.service';
import { IdempotencyService } from './common/middleware/idempotency.service';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3002', 10);

console.log('🚀 Starting SchemaFlow Backend...');
console.log(`📍 Environment: ${dev ? 'development' : 'production'}`);
console.log(`📍 Port: ${port}`);

// Initialize Infrastructure
// TODO: Move these back to .env once environment loading is fixed on this machine
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "https://precise-oyster-10700.upstash.io";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "ASnMAAIncDI4NDIyYmFjNTk4Y2M0MmUyOGYzZGUyNDU5OTk5NTQ1M3AyMTA3MDA";

if (UPSTASH_URL && UPSTASH_TOKEN) {
    console.log('⏳ Connecting to Upstash Redis (HTTP)...');
    try {
        const { Redis: UpstashRedis } = require('@upstash/redis');
        const redis = new UpstashRedis({
            url: UPSTASH_URL,
            token: UPSTASH_TOKEN,
        });
        console.log('✅ Upstash Redis (HTTP) configured');

        CacheService.initialize(redis);
        IdempotencyService.initialize(redis);
    } catch (e) {
        console.error('❌ Failed to initialize Upstash Redis:', e);
        // Fallback to memory
        CacheService.initialize();
        IdempotencyService.initialize();
    }
} else if (process.env.REDIS_URL) {
    console.log('⏳ Connecting to Redis (TCP)...');
    const redis = new Redis(process.env.REDIS_URL, {
        family: 4,
        tls: {
            rejectUnauthorized: false
        }
    });

    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => console.error('❌ Redis Connection Error:', err));

    CacheService.initialize(redis);
    IdempotencyService.initialize(redis);
} else {
    console.warn('⚠️ No REDIS_URL found. Using In-Memory stores (not recommended for production).');
    CacheService.initialize();
    IdempotencyService.initialize();
}


// Initialize Next.js app
console.log('⏳ Initializing Next.js...');
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    console.log('✅ Next.js ready');
    console.log('⏳ Creating HTTP server...');

    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    console.log('⏳ Initializing Socket.IO...');
    // Initialize Socket.io on the same HTTP server
    const io = new Server(server, {
        path: '/api/socket/io',
        addTrailingSlash: false,
        cors: {
            origin: '*', // Allow all in dev. Restrict in prod
            methods: ["GET", "POST"]
        }
    });

    // Initialize our Socket Handler
    new SocketHandler(io);
    console.log('✅ Socket.IO ready');

    server.listen(port, () => {
        console.log('');
        console.log('🎉 ================================');
        console.log(`✅ Server ready on http://${hostname}:${port}`);
        console.log(`✅ Socket.IO ready on /api/socket/io`);
        console.log('🎉 ================================');
        console.log('');
    });
}).catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
