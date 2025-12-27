import { NextRequest } from 'next/server';
import { ResponseUtil } from '@/common/utils/response.util';
import { MysqlIntrospector } from '@/services/import/mysql.introspector';
import { MongoIntrospector } from '@/services/import/mongo.introspector';
import { z } from 'zod';

const ImportSchema = z.object({
    type: z.enum(['MYSQL', 'MONGODB']),
    connectionString: z.string().min(1, 'Connection string is required'),
});

export class ImportController {
    static async execute(req: NextRequest) {
        try {
            const body = await req.json();
            const validation = ImportSchema.safeParse(body);

            if (!validation.success) {
                return ResponseUtil.error(JSON.stringify(validation.error.issues), 400, 'VALIDATION_ERROR');
            }

            const { type, connectionString } = validation.data;
            let content;

            // TODO: In production, offload this to a Job Queue (BullMQ) to prevent timeouts
            if (type === 'MYSQL') {
                content = await MysqlIntrospector.introspect(connectionString);
            } else {
                content = await MongoIntrospector.introspect(connectionString);
            }

            return ResponseUtil.success(content);
        } catch (error) {
            console.error('Import failed', error);
            return ResponseUtil.handleError(error);
        }
    }
}
