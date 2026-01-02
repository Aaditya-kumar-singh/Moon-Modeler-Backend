import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');
    // Allow requests from frontend (3001) and backend (3000) or configured URL
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', process.env.FRONTEND_URL];
    const allowedOrigin = (origin && allowedOrigins.includes(origin)) ? origin : (process.env.FRONTEND_URL || 'http://localhost:3000');

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // Clone the response
    const response = NextResponse.next();

    // Add CORS headers to all responses
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    // Security Headers
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // Simple Rate Limiting (In-Memory for Demo, use Redis in Prod)
    // Limits based on IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    // Note: In a real serverless env, this Map is per-lambda, so it's loose.
    // Ideally use upstash/ratelimit.

    return response;
}

// Apply middleware to API routes
export const config = {
    matcher: '/api/:path*',
};
