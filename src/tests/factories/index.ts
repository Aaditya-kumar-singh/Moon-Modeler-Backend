import { prisma } from '@/common/prisma.service';
import { DatabaseType } from '@prisma/client';

/**
 * User Factory
 * 
 * Creates test users with sensible defaults.
 * 
 * Usage:
 * ```typescript
 * const user = await UserFactory.create();
 * const customUser = await UserFactory.create({ email: 'custom@test.com' });
 * ```
 */
export class UserFactory {
    private static counter = 0;

    static async create(overrides: {
        email?: string;
        name?: string;
    } = {}) {
        this.counter++;

        return prisma.user.create({
            data: {
                email: overrides.email || `user${this.counter}@test.com`,
                name: overrides.name || `Test User ${this.counter}`,
            }
        });
    }

    /**
     * Create multiple users at once
     */
    static async createMany(count: number, overrides: any = {}) {
        const users = [];
        for (let i = 0; i < count; i++) {
            users.push(await this.create(overrides));
        }
        return users;
    }

    /**
     * Reset counter (useful between tests)
     */
    static reset() {
        this.counter = 0;
    }
}

/**
 * Project Factory
 * 
 * Creates test projects with optional relationships.
 * 
 * Usage:
 * ```typescript
 * const project = await ProjectFactory.create();
 * const userProject = await ProjectFactory.create({ owner: user });
 * const teamProject = await ProjectFactory.create({ team: team });
 * ```
 */
export class ProjectFactory {
    private static counter = 0;

    static async create(overrides: {
        name?: string;
        type?: DatabaseType;
        content?: any;
        owner?: { id: string };
        team?: { id: string };
    } = {}) {
        this.counter++;

        // Create owner if not provided
        let userId = overrides.owner?.id;
        if (!userId && !overrides.team) {
            const user = await UserFactory.create();
            userId = user.id;
        }

        return prisma.project.create({
            data: {
                name: overrides.name || `Test Project ${this.counter}`,
                type: overrides.type || DatabaseType.MYSQL,
                content: overrides.content || { nodes: [], edges: [] },
                userId: userId,
                teamId: overrides.team?.id,
            },
            include: {
                user: true,
                team: true,
            }
        });
    }

    /**
     * Create project with diagram content
     */
    static async createWithDiagram(overrides: {
        owner?: { id: string };
        team?: { id: string };
        nodes?: any[];
        edges?: any[];
    } = {}) {
        return this.create({
            ...overrides,
            content: {
                nodes: overrides.nodes || [
                    { id: '1', type: 'tableNode', data: { name: 'users' } },
                    { id: '2', type: 'tableNode', data: { name: 'posts' } }
                ],
                edges: overrides.edges || [
                    { id: 'e1-2', source: '1', target: '2', type: 'relation' }
                ]
            }
        });
    }

    /**
     * Create project with versions
     */
    static async createWithVersions(versionCount: number = 3, overrides: any = {}) {
        const project = await this.create(overrides);

        // Create version history
        for (let i = 0; i < versionCount; i++) {
            await prisma.projectVersion.create({
                data: {
                    projectId: project.id,
                    content: {
                        nodes: [{ id: `${i}`, data: { name: `version_${i}` } }],
                        edges: []
                    },
                    description: `Version ${i + 1}`
                }
            });
        }

        return project;
    }

    static reset() {
        this.counter = 0;
    }
}

/**
 * Team Factory
 * 
 * Creates test teams with members.
 * 
 * Usage:
 * ```typescript
 * const team = await TeamFactory.create();
 * const teamWithOwner = await TeamFactory.create({ owner: user });
 * ```
 */
export class TeamFactory {
    private static counter = 0;

    static async create(overrides: {
        name?: string;
        owner?: { id: string };
    } = {}) {
        this.counter++;

        // Create owner if not provided
        let ownerId = overrides.owner?.id;
        if (!ownerId) {
            const user = await UserFactory.create();
            ownerId = user.id;
        }

        // Create team
        const team = await prisma.team.create({
            data: {
                name: overrides.name || `Test Team ${this.counter}`,
            }
        });

        // Add owner
        await prisma.teamToken.create({
            data: {
                teamId: team.id,
                userId: ownerId,
                role: 'OWNER'
            }
        });

        return prisma.team.findUnique({
            where: { id: team.id },
            include: { members: true }
        });
    }

    /**
     * Create team with multiple members
     */
    static async createWithMembers(memberCount: number = 3, overrides: any = {}) {
        const team = await this.create(overrides);

        // Add additional members
        for (let i = 0; i < memberCount - 1; i++) { // -1 because owner already added
            const user = await UserFactory.create();
            await prisma.teamToken.create({
                data: {
                    teamId: team!.id,
                    userId: user.id,
                    role: i % 2 === 0 ? 'EDITOR' : 'VIEWER'
                }
            });
        }

        return prisma.team.findUnique({
            where: { id: team!.id },
            include: { members: { include: { user: true } } }
        });
    }

    static reset() {
        this.counter = 0;
    }
}

/**
 * Audit Log Factory
 * 
 * Creates test audit logs.
 * 
 * Usage:
 * ```typescript
 * const log = await AuditLogFactory.create({ userId: user.id });
 * ```
 */
export class AuditLogFactory {
    static async create(overrides: {
        userId?: string;
        action?: string;
        resourceId?: string;
        metadata?: any;
    } = {}) {
        let userId = overrides.userId;
        if (!userId) {
            const user = await UserFactory.create();
            userId = user.id;
        }

        return prisma.auditLog.create({
            data: {
                userId,
                action: overrides.action || 'PROJECT_CREATED',
                resourceId: overrides.resourceId,
                metadata: overrides.metadata || { test: true },
            }
        });
    }

    /**
     * Create multiple audit logs for a user
     */
    static async createMany(userId: string, count: number) {
        const logs = [];
        const actions = ['PROJECT_CREATED', 'PROJECT_UPDATED', 'VERSION_RESTORED', 'MEMBER_ADDED'];

        for (let i = 0; i < count; i++) {
            logs.push(await this.create({
                userId,
                action: actions[i % actions.length],
                metadata: { index: i }
            }));
        }

        return logs;
    }
}

/**
 * Factory Helper
 * 
 * Utility functions for test data management.
 */
export class FactoryHelper {
    /**
     * Reset all factory counters
     */
    static resetAll() {
        UserFactory.reset();
        ProjectFactory.reset();
        TeamFactory.reset();
    }

    /**
     * Clean up all test data
     * WARNING: Deletes all data in database!
     */
    static async cleanupAll() {
        await prisma.auditLog.deleteMany();
        await prisma.projectVersion.deleteMany();
        await prisma.project.deleteMany();
        await prisma.teamToken.deleteMany();
        await prisma.team.deleteMany();
        await prisma.user.deleteMany();
    }

    /**
     * Create a complete test scenario
     * Returns user, team, and project
     */
    static async createScenario() {
        const owner = await UserFactory.create({ email: 'owner@test.com' });
        const team = await TeamFactory.createWithMembers(3, { owner });

        if (!team) {
            throw new Error('Failed to create team');
        }

        const project = await ProjectFactory.createWithDiagram({ team: { id: team.id } });

        return { owner, team, project };
    }
}
