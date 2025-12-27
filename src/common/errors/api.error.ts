export class ApiError extends Error {
    public readonly code: string;
    public readonly status: number;

    constructor(code: string, message: string, status: number = 500) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'ApiError';

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }

    // Factory methods for common errors
    static notFound(resource: string, id?: string): ApiError {
        return new ApiError(
            `${resource.toUpperCase()}_NOT_FOUND`,
            id ? `${resource} with id '${id}' not found` : `${resource} not found`,
            404
        );
    }

    static forbidden(action: string): ApiError {
        return new ApiError(
            'FORBIDDEN',
            `You do not have permission to ${action}`,
            403
        );
    }

    static conflict(message: string): ApiError {
        return new ApiError(
            'CONFLICT',
            message,
            409
        );
    }

    static badRequest(message: string): ApiError {
        return new ApiError(
            'BAD_REQUEST',
            message,
            400
        );
    }

    static unauthorized(message: string = 'Unauthorized'): ApiError {
        return new ApiError(
            'UNAUTHORIZED',
            message,
            401
        );
    }
}
