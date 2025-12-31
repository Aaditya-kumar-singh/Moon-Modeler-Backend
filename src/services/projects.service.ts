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
            // DEV HAXX: Ensure mock user exists so FK doesn't fail
            if (userId === 'mock-user-id') {
                await tx.user.upsert({
                    where: { id: userId },
                    create: { id: userId, email: 'mock@example.com', name: 'Mock User' },
                    update: {},
                });
            }

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

    async getUserProjects(userId: string, options: {
        page?: number;
        limit?: number;
        type?: 'MONGODB' | 'MYSQL';
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    } = {}) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const orderBy = { [options.sortBy || 'updatedAt']: options.sortOrder || 'desc' };

        const where: Prisma.ProjectWhereInput = { userId };
        if (options.type) {
            where.type = options.type;
        }

        const [total, projects] = await Promise.all([
            prisma.project.count({ where }),
            this.getAllObjects({
                where,
                orderBy,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    description: true,
                    userId: true,
                    teamId: true,
                    createdAt: true,
                    updatedAt: true,
                    version: true,
                    team: true,
                    // content field is EXPLICITLY OMITTED to optimize performance
                },
            })
        ]);

        return {
            projects,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    }

    async getProjectById(id: string, userId: string) {
        const project = await this.getObjectById(id);
        if (!project) throw ApiError.notFound('Project', id);

        // Access Control: Check ownership or Team membership
        if (project.userId !== userId && !project.teamId) {
            throw ApiError.forbidden('You do not have permission to view this project.');
        }

        return project;
    }

    async saveDiagram(projectId: string, content: any, userId: string, expectedVersion?: number, forceSnapshot: boolean = false) {
        // 1. Validate JSON
        ProjectsValidator.validateDiagram(content);

        // 2. Hash New Content
        const newHash = this.createHash(content);

        // 3. Fetch current state (No Transaction)
        // Forced cast to ensure 'version' is recognized if IDE is stale
        const current = await prisma.project.findUnique({ where: { id: projectId } }) as Project;

        if (!current) throw ApiError.notFound('Project', projectId);

        // Optimistic Locking Check
        if (expectedVersion !== undefined && (current as any).version !== expectedVersion) {
            throw ApiError.conflict('Project has been modified by another user. Reload required.');
        }

        // RBAC Check
        if (current.userId !== userId && !current.teamId) {
            // Allow if team member... (todo)
        }

        // 4. Auto-Versioning Logic (Smart Throttling)
        const currentHash = this.createHash(current.content);

        if (currentHash !== newHash || forceSnapshot) {
            // Check last version time
            const lastVersion = await prisma.projectVersion.findFirst({
                where: { projectId },
                orderBy: { createdAt: 'desc' }
            });

            const FIVE_MINUTES = 5 * 60 * 1000;
            const shouldSaveVersion = forceSnapshot || !lastVersion || (Date.now() - lastVersion.createdAt.getTime() > FIVE_MINUTES);

            if (shouldSaveVersion) {
                await prisma.projectVersion.create({
                    data: {
                        projectId,
                        content: current.content ?? {}, // Saving the OLD state as backup
                        description: forceSnapshot ? 'Backup before Restore' : 'Auto-save (Smart)',
                    },
                });
            }
        }

        // 5. Update the live project with Version Increment
        return prisma.project.update({
            where: { id: projectId },
            data: {
                content,
                // @ts-ignore: Version field exists in DB but types might be stale
                version: { increment: 1 } // ATOMIC INCREMENT
            }
        });
    }

    async getVersions(projectId: string, options: { page?: number; limit?: number } = {}) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;

        const [total, versions] = await Promise.all([
            prisma.projectVersion.count({ where: { projectId } }),
            prisma.projectVersion.findMany({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            })
        ]);

        return {
            versions,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
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
