import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProjectsService } from '@/services/projects.service';
import { prisma } from '@/common/prisma.service';

// Mock Prisma
jest.mock('@/common/prisma.service', () => ({
    prisma: {
        project: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        projectVersion: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback({
            project: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            projectVersion: {
                findFirst: jest.fn(),
                create: jest.fn(),
            }
        })),
    }
}));

describe('ProjectsService - Versioning Logic', () => {
    let service: ProjectsService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectsService();
    });

    describe('Smart Throttling - Auto-save Logic', () => {
        it('should create version snapshot when content changes and > 5 minutes passed', async () => {
            const projectId = 'test-project-id';
            const userId = 'test-user-id';
            const oldContent = { nodes: [], edges: [] };
            const newContent = { nodes: [{ id: '1' }], edges: [] };

            // Mock current project state
            const mockProject = {
                id: projectId,
                content: oldContent,
                version: 1,
                userId,
                teamId: null,
            };

            // Mock last version created > 5 minutes ago
            const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
            const mockLastVersion = {
                id: 'version-1',
                projectId,
                content: oldContent,
                createdAt: sixMinutesAgo,
            };

            const mockTransaction = {
                project: {
                    findUnique: jest.fn().mockResolvedValue(mockProject),
                    update: jest.fn().mockResolvedValue({ ...mockProject, content: newContent, version: 2 }),
                },
                projectVersion: {
                    findFirst: jest.fn().mockResolvedValue(mockLastVersion),
                    create: jest.fn().mockResolvedValue({ id: 'version-2' }),
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockTransaction));

            await service.saveDiagram(projectId, newContent, userId);

            // Verify version was created
            expect(mockTransaction.projectVersion.create).toHaveBeenCalledWith({
                data: {
                    projectId,
                    content: oldContent,
                    description: 'Auto-save (Smart)',
                }
            });
        });

        it('should NOT create version when content changes but < 5 minutes passed', async () => {
            const projectId = 'test-project-id';
            const userId = 'test-user-id';
            const oldContent = { nodes: [], edges: [] };
            const newContent = { nodes: [{ id: '1' }], edges: [] };

            const mockProject = {
                id: projectId,
                content: oldContent,
                version: 1,
                userId,
                teamId: null,
            };

            // Mock last version created < 5 minutes ago
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const mockLastVersion = {
                id: 'version-1',
                projectId,
                content: oldContent,
                createdAt: twoMinutesAgo,
            };

            const mockTransaction = {
                project: {
                    findUnique: jest.fn().mockResolvedValue(mockProject),
                    update: jest.fn().mockResolvedValue({ ...mockProject, content: newContent, version: 2 }),
                },
                projectVersion: {
                    findFirst: jest.fn().mockResolvedValue(mockLastVersion),
                    create: jest.fn(),
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockTransaction));

            await service.saveDiagram(projectId, newContent, userId);

            // Verify version was NOT created
            expect(mockTransaction.projectVersion.create).not.toHaveBeenCalled();
        });

        it('should create version when forceSnapshot is true regardless of time', async () => {
            const projectId = 'test-project-id';
            const userId = 'test-user-id';
            const oldContent = { nodes: [], edges: [] };
            const newContent = { nodes: [{ id: '1' }], edges: [] };

            const mockProject = {
                id: projectId,
                content: oldContent,
                version: 1,
                userId,
                teamId: null,
            };

            // Mock last version created just now
            const justNow = new Date();
            const mockLastVersion = {
                id: 'version-1',
                projectId,
                content: oldContent,
                createdAt: justNow,
            };

            const mockTransaction = {
                project: {
                    findUnique: jest.fn().mockResolvedValue(mockProject),
                    update: jest.fn().mockResolvedValue({ ...mockProject, content: newContent, version: 2 }),
                },
                projectVersion: {
                    findFirst: jest.fn().mockResolvedValue(mockLastVersion),
                    create: jest.fn().mockResolvedValue({ id: 'version-2' }),
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockTransaction));

            // Force snapshot
            await service.saveDiagram(projectId, newContent, userId, undefined, true);

            // Verify version was created with special description
            expect(mockTransaction.projectVersion.create).toHaveBeenCalledWith({
                data: {
                    projectId,
                    content: oldContent,
                    description: 'Backup before Restore',
                }
            });
        });

        it('should NOT create version when content is identical (same hash)', async () => {
            const projectId = 'test-project-id';
            const userId = 'test-user-id';
            const sameContent = { nodes: [{ id: '1' }], edges: [] };

            const mockProject = {
                id: projectId,
                content: sameContent,
                version: 1,
                userId,
                teamId: null,
            };

            const mockTransaction = {
                project: {
                    findUnique: jest.fn().mockResolvedValue(mockProject),
                    update: jest.fn().mockResolvedValue({ ...mockProject, version: 2 }),
                },
                projectVersion: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockTransaction));

            await service.saveDiagram(projectId, sameContent, userId);

            // Verify version was NOT created (content unchanged)
            expect(mockTransaction.projectVersion.create).not.toHaveBeenCalled();
            expect(mockTransaction.projectVersion.findFirst).not.toHaveBeenCalled();
        });
    });

    describe('Optimistic Locking', () => {
        it('should throw conflict error when version mismatch', async () => {
            const projectId = 'test-project-id';
            const userId = 'test-user-id';
            const newContent = { nodes: [{ id: '1' }], edges: [] };

            const mockProject = {
                id: projectId,
                content: { nodes: [], edges: [] },
                version: 5, // Current version is 5
                userId,
                teamId: null,
            };

            const mockTransaction = {
                project: {
                    findUnique: jest.fn().mockResolvedValue(mockProject),
                    update: jest.fn(),
                },
                projectVersion: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockTransaction));

            // Client thinks version is 3, but it's actually 5
            await expect(service.saveDiagram(projectId, newContent, userId, 3))
                .rejects
                .toThrow('Project has been modified by another user');
        });

        it('should succeed when version matches', async () => {
            const projectId = 'test-project-id';
            const userId = 'test-user-id';
            const newContent = { nodes: [{ id: '1' }], edges: [] };

            const mockProject = {
                id: projectId,
                content: { nodes: [], edges: [] },
                version: 5,
                userId,
                teamId: null,
            };

            const mockTransaction = {
                project: {
                    findUnique: jest.fn().mockResolvedValue(mockProject),
                    update: jest.fn().mockResolvedValue({ ...mockProject, content: newContent, version: 6 }),
                },
                projectVersion: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn(),
                }
            };

            (prisma.$transaction as jest.Mock).mockImplementation((callback) => callback(mockTransaction));

            await expect(service.saveDiagram(projectId, newContent, userId, 5))
                .resolves
                .toBeDefined();
        });
    });
});
