import { NextResponse } from 'next/server';
import { ApiError } from '../errors/api.error';

export const ResponseStatus = {
    STATUS_SUCCESS_OK: 200,
    STATUS_SUCCESS_CREATED: 201,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
    PERMISSION_DENIED: 403,
} as const;

export class ResponseUtil {
    static success(data: any, status: number = 200) {
        return NextResponse.json({ data }, { status });
    }

    static error(message: string, status: number = 500, code?: string) {
        return NextResponse.json(
            {
                error: {
                    code: code || 'INTERNAL_ERROR',
                    message
                }
            },
            { status }
        );
    }

    static handleError(error: unknown) {
        if (error instanceof ApiError) {
            return this.error(error.message, error.status, error.code);
        }

        // Generic error fallback
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return this.error(message, 500, 'INTERNAL_ERROR');
    }
}
