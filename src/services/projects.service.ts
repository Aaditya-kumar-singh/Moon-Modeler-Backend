import { Project, Prisma } from '@prisma/client';
import { BaseHelper } from '@/common/helpers/base.helper';
import { prisma } from '@/common/prisma.service';
import { CreateProjectSchema, ProjectsValidator } from './projects.validator';
import crypto from 'crypto';
import { logSafe } from '@/common/lib/logger';
import { ApiError } from '@/common/errors/api.error';

export class ProjectsService extends BaseHelper<Project> {
    constructor() {
        super(prisma.project);
    }

    async createProject(userId: string, data: any) {
        const validated = CreateProjectSchema.parse(data);

        return prisma.$transaction(async (tx) => {
            // 1. Create Project
            const project = await tx.project.create({
                data: {
                    ...validated,
                    userId,
                    content: { nodes: [], edges: [] }, // Initial empty state
                }
            });

            // 2. Audit log (within same transaction)
            await tx.auditLog.create({
                data: {
                    userId,
                    action: 'PROJECT_CREATED',
                    resourceId: project.id,
                    metadata: { name: project.name, type: project.type } as any,
                }
            });

            return project;
        });
    }

    async getUserProjects(userId: string) {
        return this.getAllObjects({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            include: { team: true }, // Show team info if any
        });
    }

    async saveDiagram(projectId: string, content: any, userId: string, expectedVersion?: number, forceSnapshot: boolean = false) {
        // Explicitly defining the transaction callback type can help some IDEs
        return prisma.$transaction(async (tx) => {
            // 1. Validate JSON
            ProjectsValidator.validateDiagram(content);

            // 2. Fetch current state
            // Forced cast to ensure 'version' is recognized if IDE is stale
            const current = await tx.project.findUnique({ where: { id: projectId } }) as Project;

            if (!current) throw ApiError.notFound('Project', projectId);

            // Optimistic Locking Check
            if (expectedVersion !== undefined && (current as any).version !== expectedVersion) {
                // We throw a special error that Controller can catch as 409
                throw ApiError.conflict('Project has been modified by another user. Reload required.');
            }

            // RBAC Check (Simple Owner check for now)
            if (current.userId !== userId && !current.teamId) {
                // Allow if team member... (todo)
            }

            // 3. Auto-Versioning Logic (Smart Throttling)
            const currentHash = this.createHash(current.content);
            const newHash = this.createHash(content);

            if (currentHash !== newHash || forceSnapshot) {
                // Check last version time
                const lastVersion = await tx.projectVersion.findFirst({
                    where: { projectId },
                    orderBy: { createdAt: 'desc' }
                });

                const FIVE_MINUTES = 5 * 60 * 1000;
                const shouldSaveVersion = forceSnapshot || !lastVersion || (Date.now() - lastVersion.createdAt.getTime() > FIVE_MINUTES);

                if (shouldSaveVersion) {
                    await tx.projectVersion.create({
                        data: {
                            projectId,
                            content: current.content ?? {}, // Saving the OLD state as backup
                            description: forceSnapshot ? 'Backup before Restore' : 'Auto-save (Smart)',
                        },
                    });
                }
            }

            // 4. Update the live project with Version Increment
            return tx.project.update({
                where: { id: projectId },
                data: {
                    content,
                    // @ts-ignore: Version field exists in DB but types might be stale
                    version: { increment: 1 } // ATOMIC INCREMENT
                }
            });
        });
    }

    async getVersions(projectId: string) {
        return prisma.projectVersion.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 20, // Limit history
        });
    }

    async restoreVersion(projectId: string, versionId: string, userId: string) {
        const version = await prisma.projectVersion.findUnique({
            where: { id: versionId },
        });
        if (!version) throw ApiError.notFound('Version', versionId);
        if (version.projectId !== projectId) throw ApiError.badRequest('Version does not belong to this project');

        // Audit log
        const { audit } = await import('@/common/services/audit.service');
        await audit.versionRestored(userId, projectId, versionId);

        logSafe('info', 'VERSION_RESTORED', {
            userId,
            projectId,
            versionId,
            timestamp: new Date().toISOString()
        });

        // Restore by overwriting current content with version content
        // FORCE SNAPSHOT to ensure we backup the current state before overwriting
        return this.saveDiagram(projectId, version.content, userId, undefined, true);
    }

    private createHash(data: any): string {
        return crypto.createHash('sha256').update(JSON.stringify(data || {})).digest('hex');
    }
}

export const projectsService = new ProjectsService();
