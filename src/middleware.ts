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

    return response;
}

// Apply middleware to API routes
export const config = {
    matcher: '/api/:path*',
};
