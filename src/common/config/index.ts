/**
 * Configuration Management for Moon Modeler Backend
 * 
 * This module provides a centralized, type-safe way to access configuration values.
 * In production, secrets are injected via encrypted environment variables.
 * 
 * Supported Platforms:
 * - Vercel (Environment Variables - encrypted at rest)
 * - AWS (Secrets Manager)
 * - Azure (Key Vault)
 * - HashiCorp Vault
 */

export const config = {
    // Database
    database: {
        url: process.env.DATABASE_URL || '',
    },

    // Authentication
    auth: {
        secret: process.env.NEXTAUTH_SECRET || '',
        url: process.env.NEXTAUTH_URL || 'http://localhost:3002',
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },

    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',

    // Security
    security: {
        // Rate limiting (requests per minute)
        rateLimit: {
            auth: parseInt(process.env.RATE_LIMIT_AUTH || '5'),
            import: parseInt(process.env.RATE_LIMIT_IMPORT || '10'),
            save: parseInt(process.env.RATE_LIMIT_SAVE || '60'),
        }
    }
} as const;

/**
 * Validates that all required environment variables are set
 * Call this at application startup
 */
export function validateConfig() {
    const required = [
        'DATABASE_URL',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            `Please check your .env file or environment configuration.`
        );
    }

    // Warn about missing optional but recommended variables
    const recommended = ['NEXTAUTH_SECRET'];
    const missingRecommended = recommended.filter(key => !process.env[key]);

    if (missingRecommended.length > 0 && config.isProduction) {
        console.warn(
            `⚠️  Missing recommended environment variables: ${missingRecommended.join(', ')}`
        );
    }
}

/**
 * Security Note:
 * 
 * This configuration module does NOT store secrets.
 * It only reads from environment variables which should be:
 * 
 * 1. LOCAL DEV: Set in .env file (gitignored)
 * 2. PRODUCTION: Injected by platform (Vercel, AWS, etc.)
 * 
 * NEVER hardcode secrets in this file or commit them to git!
 */
