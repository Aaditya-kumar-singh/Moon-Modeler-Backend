import { NextRequest } from 'next/server';
import { projectsService } from '@/services/projects.service';
import { ResponseUtil } from '@/common/utils/response.util';
import { z } from 'zod';
import { MysqlExporter } from '@/services/export/mysql.exporter';
import { MongoExporter } from '@/services/export/mongo.exporter';
import { DiagramContent } from '@/types/diagram';

// Mock Auth until we implement NextAuth
const getUserId = (req: NextRequest) => 'mock-user-id';

export class ProjectsController {

    static async list(req: NextRequest) {
        try {
            const userId = getUserId(req);
            const projects = await projectsService.getUserProjects(userId);
            return ResponseUtil.success(projects);
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
                if (error instanceof z.ZodError) {
                    return ResponseUtil.error(JSON.stringify(error.issues), 400, 'VALIDATION_ERROR');
                }
                return ResponseUtil.handleError(error);
            }
        });
    }

    static async getOne(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const project = await projectsService.getObjectById(params.id);
            if (!project) return ResponseUtil.error('Not found', 404, 'PROJECT_NOT_FOUND');
            return ResponseUtil.success(project);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async update(req: NextRequest, { params }: { params: { id: string } }) {
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
            if (error instanceof z.ZodError) {
                return ResponseUtil.error(JSON.stringify(error.issues), 400, 'VALIDATION_ERROR');
            }
            return ResponseUtil.handleError(error);
        }
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
}
