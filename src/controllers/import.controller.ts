import { NextRequest } from 'next/server';
import { ResponseUtil } from '@/common/utils/response.util';
import { MysqlIntrospector } from '@/services/import/mysql.introspector';
import { MongoIntrospector } from '@/services/import/mongo.introspector';
import { ImportSchema } from '@/services/projects.validator';

export class ImportController {
    static async execute(req: NextRequest) {
        try {
            const body = await req.json();
            const { type, connectionString } = ImportSchema.parse(body); // Throws ZodError on failure
            let content;

            // TODO: In production, offload this to a Job Queue (BullMQ) to prevent timeouts
            if (type === 'MYSQL') {
                content = await MysqlIntrospector.introspect(connectionString);
            } else {
                content = await MongoIntrospector.introspect(connectionString);
            }

            return ResponseUtil.success(content);
        } catch (error: any) {
            console.error('Import failed', error);

            // Common Connection Errors
            const isConnectionError =
                error.code === 'ECONNREFUSED' ||
                error.code === 'ER_ACCESS_DENIED_ERROR' ||
                error.code === 'ENOTFOUND' ||
                error.name === 'MongoServerSelectionError' ||
                error.name === 'MongoTimeoutError' ||
                error.message?.includes('Authentication failed');

            if (isConnectionError) {
                return ResponseUtil.error(
                    `Connection failed: ${error.message || 'Unable to reach database'}`,
                    400,
                    'CONNECTION_FAILED'
                );
            }

            // Authentication/Authorization Errors
            if (error.code === 13 || error.codeName === 'Unauthorized') {
                return ResponseUtil.error(
                    `Permission denied: Your user cannot list collections. Try adding '?authSource=admin' to your URI or check user roles.`,
                    403,
                    'UNAUTHORIZED'
                );
            }

            return ResponseUtil.handleError(error);
        }
    }
}
