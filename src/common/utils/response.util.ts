import { NextResponse } from 'next/server';
import { ApiError } from '../errors/api.error';
import { z } from 'zod';

export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: string;
};

export class ResponseUtil {
    static success<T>(data: T, status: number = 200, headers: HeadersInit = {}) {
        const payload: ApiResponse<T> = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
        };
        return NextResponse.json(payload, { status, headers });
    }

    static error(message: string, status: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
        const payload: ApiResponse = {
            success: false,
            error: {
                code,
                message,
                details
            },
            timestamp: new Date().toISOString(),
        };
        return NextResponse.json(payload, { status });
    }

    static handleError(error: unknown) {
        // 1. Handle Known API Errors
        if (error instanceof ApiError) {
            return this.error(error.message, error.status, error.code);
        }

        // 2. Handle Zod Validation Errors
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code
            }));
            return this.error('Validation failed', 400, 'VALIDATION_ERROR', issues);
        }

        // 3. Handle Prisma Errors
        // @ts-ignore
        if (error?.code && error?.clientVersion) {
            // @ts-ignore
            switch (error.code) {
                case 'P2002':
                    // @ts-ignore
                    const target = error.meta?.target || 'field';
                    return this.error(`Duplicate entry for ${target}`, 409, 'DUPLICATE_ENTRY', { target });
                case 'P2025':
                    return this.error('Record not found', 404, 'NOT_FOUND');
                case 'P1001':
                    return this.error('Database connection failed', 503, 'DB_CONNECTION_ERROR');
            }
        }

        // 4. Handle Generic Errors
        console.error('[Unhandled Error]:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        // In production, we might want to hide the real message for security, but for dev we keep it.
        const isDev = process.env.NODE_ENV === 'development';
        return this.error(isDev ? message : 'Internal Server Error', 500, 'INTERNAL_ERROR');
    }
}
