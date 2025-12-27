import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProjectsService } from '@/services/projects.service';
import { UserFactory, ProjectFactory, FactoryHelper } from '../factories';

/**
 * Integration Tests for ProjectsService
 * 
 * These tests use real database operations with test factories
 * for clean, readable, and maintainable test data.
 */
describe('ProjectsService - Integration Tests', () => {
    let service: ProjectsService;

    beforeEach(async () => {
        service = new ProjectsService();
        FactoryHelper.resetAll();
    });

    afterEach(async () => {
        await FactoryHelper.cleanupAll();
    });

    describe('createProject', () => {
        it('should create a project with audit log', async () => {
            const user = await UserFactory.create({ email: 'test@example.com' });

            const project = await service.createProject(user.id, {
                name: 'My Project',
                type: 'MYSQL'
            });

            expect(project.name).toBe('My Project');
            expect(project.userId).toBe(user.id);
            expect((project as any).version).toBe(0); // Type assertion for version field
        });

        it('should create project with empty diagram', async () => {
            const user = await UserFactory.create();

            const project = await service.createProject(user.id, {
                name: 'Empty Project',
                type: 'MONGODB'
            });

            expect(project.content).toEqual({ nodes: [], edges: [] });
        });
    });

    describe('saveDiagram - Optimistic Locking', () => {
        it('should save diagram and increment version', async () => {
            const user = await UserFactory.create();
            const project = await ProjectFactory.create({ owner: user });

            const newContent = {
                nodes: [{ id: '1', type: 'table', data: { name: 'users' } }],
                edges: []
            };

            const updated = await service.saveDiagram(
                project.id,
                newContent,
                user.id
            );

            expect(updated.content).toEqual(newContent);
            expect((updated as any).version).toBe(1); // Incremented from 0
        });

        it('should throw conflict error on version mismatch', async () => {
            const user = await UserFactory.create();
            const project = await ProjectFactory.create({ owner: user });

            // Simulate another user updating first
            await service.saveDiagram(project.id, { nodes: [], edges: [] }, user.id);

            // Now try to save with stale version
            await expect(
                service.saveDiagram(
                    project.id,
                    { nodes: [{ id: '1' }], edges: [] },
                    user.id,
                    0 // Stale version (current is 1)
                )
            ).rejects.toThrow('Project has been modified by another user');
        });

        it('should succeed when version matches', async () => {
            const user = await UserFactory.create();
            const project = await ProjectFactory.create({ owner: user });

            // First save (version 0 → 1)
            await service.saveDiagram(project.id, { nodes: [], edges: [] }, user.id);

            // Second save with correct version (version 1 → 2)
            const updated = await service.saveDiagram(
                project.id,
                { nodes: [{ id: '1' }], edges: [] },
                user.id,
                1 // Correct current version
            );

            expect((updated as any).version).toBe(2);
        });
    });

    describe('saveDiagram - Smart Versioning', () => {
        it('should create version snapshot when content changes', async () => {
            const user = await UserFactory.create();
            const project = await ProjectFactory.createWithDiagram({ owner: user });

            const newContent = {
                nodes: [{ id: '3', type: 'table', data: { name: 'orders' } }],
                edges: []
            };

            await service.saveDiagram(project.id, newContent, user.id);

            const versions = await service.getVersions(project.id);
            expect(versions.length).toBeGreaterThan(0);
        });

        it('should NOT create version when content is identical', async () => {
            const user = await UserFactory.create();
            const content = { nodes: [{ id: '1' }], edges: [] };
            const project = await ProjectFactory.create({
                owner: user,
                content
            });

            // Save same content
            await service.saveDiagram(project.id, content, user.id);

            const versions = await service.getVersions(project.id);
            expect(versions.length).toBe(0); // No version created
        });
    });

    describe('restoreVersion', () => {
        it('should restore project to previous version', async () => {
            const user = await UserFactory.create();
            const project = await ProjectFactory.createWithVersions(3, { owner: user });

            const versions = await service.getVersions(project.id);
            const oldVersion = versions[0]; // Most recent version

            await service.restoreVersion(project.id, oldVersion.id, user.id);

            const restored = await service.getObjectById(project.id);
            expect(restored?.content).toEqual(oldVersion.content);
        });

        it('should create backup before restoring', async () => {
            const user = await UserFactory.create();
            const project = await ProjectFactory.createWithVersions(2, { owner: user });

            const versionsBefore = await service.getVersions(project.id);
            const countBefore = versionsBefore.length;

            const oldVersion = versionsBefore[0];
            await service.restoreVersion(project.id, oldVersion.id, user.id);

            const versionsAfter = await service.getVersions(project.id);
            expect(versionsAfter.length).toBe(countBefore + 1); // Backup created
        });
    });

    describe('getUserProjects', () => {
        it('should return only user\'s projects', async () => {
            const user1 = await UserFactory.create();
            const user2 = await UserFactory.create();

            await ProjectFactory.create({ owner: user1, name: 'User 1 Project' });
            await ProjectFactory.create({ owner: user2, name: 'User 2 Project' });

            const user1Projects = await service.getUserProjects(user1.id);
            expect(user1Projects).toHaveLength(1);
            expect(user1Projects[0].name).toBe('User 1 Project');
        });

        it('should include team projects', async () => {
            const { owner, team, project } = await FactoryHelper.createScenario();

            const projects = await service.getUserProjects(owner.id);

            // Should include team project
            const teamProject = projects.find(p => p.id === project.id);
            expect(teamProject).toBeDefined();
            expect(teamProject?.teamId).toBe(team.id);
        });
    });
});
