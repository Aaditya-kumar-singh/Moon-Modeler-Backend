import { NextRequest } from 'next/server';
import { ImportController } from '@/controllers/import.controller';

export async function POST(req: NextRequest) {
    return ImportController.execute(req);
}
