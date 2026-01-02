import { NextRequest } from 'next/server';
import { ResponseUtil } from '@/common/utils/response.util';
import { MysqlExporter } from '@/services/export/mysql.exporter';
import { MongoExporter } from '@/services/export/mongo.exporter';
import { ExportSchema, ProjectsValidator } from '@/services/projects.validator';
import { DiagramContent } from '@/types/diagram';

export class ExportController {

    static async exportMySQL(req: NextRequest) {
        try {
            const body = await req.json();
            const { content } = ExportSchema.parse(body); // Throws ZodError on failure

            ProjectsValidator.validateDiagram(content);
            const sql = MysqlExporter.generate(content);

            return ResponseUtil.success({ sql });
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async exportMongoDB(req: NextRequest) {
        try {
            const body = await req.json();
            const { content } = ExportSchema.parse(body); // Throws ZodError on failure

            ProjectsValidator.validateDiagram(content);
            const scripts = MongoExporter.generate(content);

            return ResponseUtil.success({ scripts });
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }
}
