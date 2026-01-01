/**
 * MongoDB Prisma Client
 * Used for: Users, Teams, Authentication, Audit Logs
 */
import { PrismaClient } from '@prisma/client-mongo';

const globalForMongoPrisma = globalThis as unknown as {
    mongoPrisma: PrismaClient | undefined;
};

export const mongoPrisma =
    globalForMongoPrisma.mongoPrisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForMongoPrisma.mongoPrisma = mongoPrisma;
}

export default mongoPrisma;
