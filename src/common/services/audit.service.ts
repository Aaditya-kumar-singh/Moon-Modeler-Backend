import { mongoPrisma } from '@/common/mongo.service';
import { logSafe } from '@/common/lib/logger';

/**
 * Audit Log Actions
 * These represent security-critical events that must be tracked for compliance
 */
export enum AuditAction {
    // Project Actions
    PROJECT_CREATED = 'PROJECT_CREATED',
    PROJECT_DELETED = 'PROJECT_DELETED',
    PROJECT_UPDATED = 'PROJECT_UPDATED',

    // Version Actions
    VERSION_RESTORED = 'VERSION_RESTORED',
    VERSION_CREATED = 'VERSION_CREATED',

    // Team Actions
    TEAM_CREATED = 'TEAM_CREATED',
    MEMBER_ADDED = 'MEMBER_ADDED',
    MEMBER_REMOVED = 'MEMBER_REMOVED',
    MEMBER_ROLE_CHANGED = 'MEMBER_ROLE_CHANGED',

    // Import Actions
    SCHEMA_IMPORTED = 'SCHEMA_IMPORTED',
    IMPORT_FAILED = 'IMPORT_FAILED',

    // Auth Actions
    LOGIN_SUCCESS = 'LOGIN_SUCCESS',
    LOGIN_FAILED = 'LOGIN_FAILED',
    LOGOUT = 'LOGOUT',
}

export interface AuditLogEntry {
    userId: string;
    action: AuditAction;
    resourceId?: string;
    metadata?: Record<string, any>;
}

/**
 * Audit Logging Service
 * 
 * Separate from debug logs, audit logs record "Who did What and When"
 * for security compliance and forensic analysis.
 * 
 * Key Principles:
 * - Immutable: Audit logs are never updated or deleted
 * - Complete: All security-critical actions must be logged
 * - Sanitized: No sensitive data (passwords, tokens) in metadata
 */
export class AuditLogService {
    /**
     * Create an audit log entry
     */
    static async log(entry: AuditLogEntry): Promise<void> {
        try {
            // Sanitize metadata before storing
            const sanitizedMetadata = entry.metadata
                ? this.sanitizeMetadata(entry.metadata)
                : null;

            await mongoPrisma.auditLog.create({
                data: {
                    userId: entry.userId,
                    action: entry.action,
                    resourceId: entry.resourceId,
                    metadata: sanitizedMetadata as any, // Prisma JSON type
                }
            });

            // Also log to application logs for real-time monitoring
            logSafe('info', `AUDIT: ${entry.action}`, {
                userId: entry.userId,
                resourceId: entry.resourceId,
                action: entry.action,
            });
        } catch (error) {
            // CRITICAL: Audit logging failure should be logged but not throw
            // We don't want to break the main operation if audit logging fails
            logSafe('error', 'AUDIT_LOG_FAILED', {
                error: error instanceof Error ? error.message : 'Unknown error',
                action: entry.action,
            });
        }
    }

    /**
     * Query audit logs for a specific user
     */
    static async getUserAuditLogs(userId: string, limit: number = 100) {
        return mongoPrisma.auditLog.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    /**
     * Query audit logs for a specific resource
     */
    static async getResourceAuditLogs(resourceId: string, limit: number = 100) {
        return mongoPrisma.auditLog.findMany({
            where: { resourceId },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    /**
     * Query audit logs by action type
     */
    static async getAuditLogsByAction(action: AuditAction, limit: number = 100) {
        return mongoPrisma.auditLog.findMany({
            where: { action },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    /**
     * Get audit logs within a time range
     */
    static async getAuditLogsInRange(startDate: Date, endDate: Date, limit: number = 1000) {
        return mongoPrisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                }
            },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }

    /**
     * Sanitize metadata to remove sensitive information
     */
    private static sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
        const sensitiveKeys = /password|secret|token|key|credential|auth/i;

        const sanitized: Record<string, any> = {};

        for (const [key, value] of Object.entries(metadata)) {
            if (sensitiveKeys.test(key)) {
                sanitized[key] = '***REDACTED***';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeMetadata(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

/**
 * Convenience functions for common audit log operations
 */
export const audit = {
    projectCreated: (userId: string, projectId: string, metadata?: Record<string, any>) =>
        AuditLogService.log({ userId, action: AuditAction.PROJECT_CREATED, resourceId: projectId, metadata }),

    projectDeleted: (userId: string, projectId: string, metadata?: Record<string, any>) =>
        AuditLogService.log({ userId, action: AuditAction.PROJECT_DELETED, resourceId: projectId, metadata }),

    projectUpdated: (userId: string, projectId: string, metadata?: Record<string, any>) =>
        AuditLogService.log({ userId, action: AuditAction.PROJECT_UPDATED, resourceId: projectId, metadata }),

    versionRestored: (userId: string, projectId: string, versionId: string, metadata?: Record<string, any>) =>
        AuditLogService.log({
            userId,
            action: AuditAction.VERSION_RESTORED,
            resourceId: projectId,
            metadata: { ...metadata, versionId }
        }),

    memberAdded: (userId: string, teamId: string, newMemberId: string, role: string) =>
        AuditLogService.log({
            userId,
            action: AuditAction.MEMBER_ADDED,
            resourceId: teamId,
            metadata: { newMemberId, role }
        }),

    memberRemoved: (userId: string, teamId: string, removedMemberId: string) =>
        AuditLogService.log({
            userId,
            action: AuditAction.MEMBER_REMOVED,
            resourceId: teamId,
            metadata: { removedMemberId }
        }),

    schemaImported: (userId: string, database: string, tableCount: number) =>
        AuditLogService.log({
            userId,
            action: AuditAction.SCHEMA_IMPORTED,
            metadata: { database, tableCount }
        }),
};
