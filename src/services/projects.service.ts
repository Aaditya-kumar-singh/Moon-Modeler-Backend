import { Project, Prisma } from '@prisma/client-postgres';
import { BaseHelper } from '@/common/helpers/base.helper';
import { postgresPrisma } from '@/common/postgres.service';
import { mongoPrisma } from '@/common/mongo.service';
import { CreateProjectSchema, ProjectsValidator } from './projects.validator';
import crypto from 'crypto';
import { logSafe } from '@/common/lib/logger';
import { ApiError } from '@/common/errors/api.error';

export class ProjectsService extends BaseHelper<Project> {
    constructor() {
        super(postgresPrisma.project);
    }

    async createProject(userId: string, data: any) {
        const validated = CreateProjectSchema.parse(data);

        // Create in Postgres
        const project = await postgresPrisma.project.create({
            data: {
                ...validated,
                userId,
                content: { nodes: [], edges: [] },
            }
        });

        // Audit log (Mongo)
        await mongoPrisma.auditLog.create({
            data: {
                userId,
                action: 'PROJECT_CREATED',
                resourceId: project.id,
                metadata: { name: project.name, type: project.type } as any,
            }
        });

        return project;
    }

    async getUserProjects(userId: string, options: {
        page?: number;
        limit?: number;
        type?: 'MONGODB' | 'MYSQL';
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        teamId?: string;
    } = {}) {
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const orderBy = { [options.sortBy || 'updatedAt']: options.sortOrder || 'desc' };

        let where: Prisma.ProjectWhereInput = {};

        if (options.teamId) {
            const isMember = await mongoPrisma.teamToken.findFirst({
                where: { teamId: options.teamId, userId }
            });

            if (!isMember) {
                return { projects: [], total: 0, page, limit, pages: 0 };
            }

            where = { teamId: options.teamId };
        } else {
            // Personal & Shared
            where = {
                OR: [
                    { userId, teamId: null },
                    { collaborators: { some: { userId } } }
                ]
            };
        }

        if (options.type) where.type = options.type;

        const [total, projects] = await Promise.all([
            postgresPrisma.project.count({ where }),
            this.getAllObjects({
                where,
                orderBy,
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    userId: true,
                    teamId: true,
                    createdAt: true,
                    updatedAt: true,
                    version: true,
                },
            })
        ]);

        return {
            projects,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        };
    }

    async getProjectById(id: string, userId: string) {
        const project = await postgresPrisma.project.findUnique({
            where: { id },
            include: { collaborators: true }
        });
        if (!project) throw ApiError.notFound('Project', id);

        let currentUserRole = 'VIEWER';
        let hasAccess = false;

        // Check Owner
        if (project.userId === userId) {
            currentUserRole = 'OWNER';
            hasAccess = true;
        }

        // Check Collaborator
        if (!hasAccess) {
            const collaborator = project.collaborators.find(c => c.userId === userId);
            if (collaborator) {
                currentUserRole = collaborator.role;
                hasAccess = true;
            }
        }

        // Check Team
        if (!hasAccess && project.teamId) {
            const member = await mongoPrisma.teamToken.findFirst({
                where: { teamId: project.teamId, userId }
            });
            if (member) {
                currentUserRole = (member.role === 'OWNER' || member.role === 'EDITOR') ? 'EDITOR' : 'VIEWER';
                hasAccess = true;
            }
        }

        if (!hasAccess) throw ApiError.forbidden('Access denied');

        return { ...project, currentUserRole };
    }

    async saveDiagram(projectId: string, content: any, userId: string, expectedVersion?: number, forceSnapshot: boolean = false) {
        ProjectsValidator.validateDiagram(content);
        const newHash = this.createHash(content);

        // Fetch current
        const current = await postgresPrisma.project.findUnique({
            where: { id: projectId },
            include: { collaborators: true }
        }) as any;

        if (!current) throw ApiError.notFound('Project', projectId);

        // Optimistic Locking
        if (expectedVersion !== undefined && (current as any).version !== expectedVersion) {
            throw ApiError.conflict('Version conflict');
        }

        // RBAC Check
        if (current.userId !== userId) {
            const collaborator = current.collaborators?.find((c: any) => c.userId === userId);
            const isEditor = collaborator && collaborator.role === 'EDITOR';

            if (!isEditor) {
                if (current.teamId) {
                    const member = await mongoPrisma.teamToken.findFirst({
                        where: { teamId: current.teamId, userId }
                    });
                    if (!member || member.role === 'VIEWER') throw ApiError.forbidden('Read only');
                } else {
                    throw ApiError.forbidden('Read only');
                }
            }
        }

        // Auto-Versioning
        const currentHash = this.createHash(current.content);

        if (currentHash !== newHash || forceSnapshot) {
            const lastVersion = await postgresPrisma.projectVersion.findFirst({
                where: { projectId },
                orderBy: { createdAt: 'desc' }
            });

            const FIVE_MINUTES = 5 * 60 * 1000;
            const shouldSaveVersion = forceSnapshot || !lastVersion || (Date.now() - lastVersion.createdAt.getTime() > FIVE_MINUTES);

            if (shouldSaveVersion) {
                await postgresPrisma.projectVersion.create({
                    data: {
                        projectId,
                        content: current.content ?? {},
                        description: forceSnapshot ? 'Manual Backup' : 'Auto-save',
                    },
                });
            }
        }

        // Update Project
        return postgresPrisma.project.update({
            where: { id: projectId },
            data: {
                content,
                // @ts-ignore
                version: { increment: 1 }
            }
        });
    }

    async getVersions(projectId: string, options: { page?: number; limit?: number } = {}) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;

        const [total, versions] = await Promise.all([
            postgresPrisma.projectVersion.count({ where: { projectId } }),
            postgresPrisma.projectVersion.findMany({
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
        const version = await postgresPrisma.projectVersion.findUnique({
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

    // --- Collaboration Methods ---

    async shareProject(projectId: string, email: string, role: string, inviterId: string) {
        // 1. Verify project permissions
        const project = await postgresPrisma.project.findUnique({
            where: { id: projectId },
            include: { collaborators: true }
        });
        if (!project) throw ApiError.notFound('Project');

        const isOwner = project.userId === inviterId;
        const isEditor = project.collaborators.some(c => c.userId === inviterId && c.role === 'EDITOR');

        // Only Owner or Editor can invite others
        if (!isOwner && !isEditor) {
            throw ApiError.forbidden('Insufficient permissions to share this project');
        }

        // 2. Lookup User
        const userToInvite = await mongoPrisma.user.findUnique({ where: { email } });
        if (!userToInvite) {
            throw ApiError.notFound('User not found in system. Please ask them to register first.');
        }

        // 3. Add/Update Collaborator
        const existing = await postgresPrisma.projectCollaborator.findUnique({
            where: {
                projectId_userId: { projectId, userId: userToInvite.id }
            }
        });

        if (existing) {
            return postgresPrisma.projectCollaborator.update({
                where: { id: existing.id },
                data: { role }
            });
        }

        return postgresPrisma.projectCollaborator.create({
            data: {
                projectId,
                userId: userToInvite.id,
                role
            }
        });
    }

    async getProjectCollaborators(projectId: string) {
        const collaborators = await postgresPrisma.projectCollaborator.findMany({
            where: { projectId }
        });

        if (collaborators.length === 0) {
            return [];
        }

        const userIds = collaborators.map(c => c.userId);

        // Optimized: Fetch all users in one query
        const users = await mongoPrisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
        });

        // Create a map for O(1) lookup
        const userMap = new Map(users.map(u => [u.id, u]));

        const enriched = collaborators.map((c) => {
            const user = userMap.get(c.userId);
            return {
                ...c,
                user: user || { name: 'Unknown', email: 'Unknown' }
            };
        });

        return enriched;
    }

    async removeCollaborator(projectId: string, userIdToRemove: string, requesterId: string) {
        // Check permissions (Only Owner can remove?)
        const project = await postgresPrisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw ApiError.notFound('Project');

        if (project.userId !== requesterId && userIdToRemove !== requesterId) {
            // Allow user to remove THEMSELVES (leave project), otherwise only Owner
            throw ApiError.forbidden('Only the project owner can remove collaborators');
        }

        return postgresPrisma.projectCollaborator.deleteMany({
            where: {
                projectId,
                userId: userIdToRemove
            }
        });
    }
}

export const projectsService = new ProjectsService();
