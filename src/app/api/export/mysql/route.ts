import { NextRequest } from 'next/server';
import { ExportController } from '@/controllers/export.controller';

export async function POST(req: NextRequest) {
    return ExportController.exportMySQL(req);
}
