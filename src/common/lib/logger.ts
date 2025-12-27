import winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        json()
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                timestamp(),
                logFormat
            )
        }),
        new winston.transports.DailyRotateFile({
            filename: 'logs/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ],
});

// Sanitization Wrapper
export const logSafe = (level: string, message: string, meta: any = {}) => {
    // Basic sanitization
    const sanitized = JSON.parse(JSON.stringify(meta, (key, value) => {
        if (key.match(/password|secret|token|key/i)) return '***';
        return value;
    }));

    logger.log(level, message, sanitized);
};
