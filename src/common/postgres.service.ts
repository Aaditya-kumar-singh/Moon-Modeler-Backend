/**
 * PostgreSQL Prisma Client
 * Used for: Projects, Schemas, Version History
 */
import { PrismaClient } from '@prisma/client-postgres';

const globalForPostgresPrisma = globalThis as unknown as {
    postgresPrisma: PrismaClient | undefined;
};

export const postgresPrisma =
    globalForPostgresPrisma.postgresPrisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPostgresPrisma.postgresPrisma = postgresPrisma;
}

export default postgresPrisma;
