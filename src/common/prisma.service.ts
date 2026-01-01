/**
 * DEPRECATED: This file is no longer used.
 * 
 * The application now uses dual databases:
 * - MongoDB: Use `mongoPrisma` from './mongo.service'
 * - PostgreSQL: Use `postgresPrisma` from './postgres.service'
 * 
 * This file is kept for backward compatibility but should not be imported.
 */

// Re-export mongoPrisma as default for any legacy code
export { mongoPrisma as prisma } from './mongo.service';
export { mongoPrisma } from './mongo.service';
export { postgresPrisma } from './postgres.service';
