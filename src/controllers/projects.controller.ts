import { NextRequest } from 'next/server';
import { projectsService } from '@/services/projects.service';
import { ResponseUtil } from '@/common/utils/response.util';
import { z } from 'zod';
import { MysqlExporter } from '@/services/export/mysql.exporter';
import { MongoExporter } from '@/services/export/mongo.exporter';
import { DiagramContent } from '@/types/diagram';

// Mock Auth until we implement NextAuth
// Auth helper
const getUserId = (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
        throw new Error('UNAUTHORIZED: No token provided');
    }

    try {
        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch (e) {
        throw new Error('UNAUTHORIZED: Invalid token');
    }
};

export class ProjectsController {

    static async list(req: NextRequest) {
        try {
            const userId = getUserId(req);
            const { searchParams } = new URL(req.url);

            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '10');
            const type = searchParams.get('type') as 'MONGODB' | 'MYSQL' | undefined;
            const sortBy = searchParams.get('sortBy') || 'updatedAt';
            const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
            const teamId = searchParams.get('teamId') || undefined;

            const result = await projectsService.getUserProjects(userId, {
                page,
                limit,
                type,
                sortBy,
                sortOrder,
                teamId
            });

            return ResponseUtil.success(result);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async create(req: NextRequest) {
        const { IdempotencyService } = await import('@/common/middleware/idempotency.service');

        return IdempotencyService.execute(req, async () => {
            try {
                const userId = getUserId(req);
                const body = await req.json();

                const newProject = await projectsService.createProject(userId, body);
                return ResponseUtil.success(newProject, 201);
            } catch (error) {
                return ResponseUtil.handleError(error);
            }
        });
    }

    static async getOne(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const userId = getUserId(req);
            const project = await projectsService.getProjectById(params.id, userId);

            return ResponseUtil.success(project);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async update(req: NextRequest, { params }: { params: { id: string } }) {
        const { IdempotencyService } = await import('@/common/middleware/idempotency.service');

        return IdempotencyService.execute(req, async () => {
            try {
                const userId = getUserId(req);
                const body = await req.json();

                // Assuming body has content. Using SaveDiagram for complex logic
                if (body.content) {
                    // version is optional for strictly safe updates
                    const updated = await projectsService.saveDiagram(params.id, body.content, userId, body.version);
                    return ResponseUtil.success(updated);
                }
                // Fallback for simple name update
                const updated = await projectsService.updateObjectById(params.id, body);
                return ResponseUtil.success(updated);
            } catch (error) {
                console.error('[ProjectsController.update] Error:', error);
                return ResponseUtil.handleError(error);
            }
        });
    }

    static async export(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const userId = getUserId(req);
            const project = await projectsService.getObjectById(params.id);

            if (!project) return ResponseUtil.error('Not found', 404, 'PROJECT_NOT_FOUND');

            // Simple RBAC check
            // @ts-ignore
            if (project.userId !== userId && !project.teamId) {
                return ResponseUtil.error('Forbidden', 403, 'FORBIDDEN');
            }

            const content = project.content as unknown as DiagramContent;
            let resultScript = '';
            let filename = '';

            if (project.type === 'MYSQL') {
                resultScript = MysqlExporter.generate(content);
                filename = `${project.name.replace(/\s+/g, '_')}.sql`;
            } else {
                resultScript = MongoExporter.generate(content);
                filename = `${project.name.replace(/\s+/g, '_')}.js`;
            }

            return ResponseUtil.success({
                filename,
                content: resultScript
            });

        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }
    static async getVersions(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const { searchParams } = new URL(req.url);
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '20');

            const versions = await projectsService.getVersions(params.id, { page, limit });
            return ResponseUtil.success(versions);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async restoreVersion(req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
        try {
            const userId = getUserId(req);
            const restoredProject = await projectsService.restoreVersion(params.id, params.versionId, userId);
            return ResponseUtil.success(restoredProject);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    // --- Collaboration ---

    static async share(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const userId = getUserId(req);
            const body = await req.json();
            const { email, role } = z.object({
                email: z.string().email(),
                role: z.enum(['EDITOR', 'VIEWER'])
            }).parse(body);

            const result = await projectsService.shareProject(params.id, email, role, userId);
            return ResponseUtil.success(result);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async getCollaborators(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const collaborators = await projectsService.getProjectCollaborators(params.id);
            return ResponseUtil.success(collaborators);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async removeCollaborator(req: NextRequest, { params }: { params: { id: string; userId: string } }) {
        try {
            const requesterId = getUserId(req);
            await projectsService.removeCollaborator(params.id, params.userId, requesterId);
            return ResponseUtil.success({ message: 'Collaborator removed' });
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }
}
