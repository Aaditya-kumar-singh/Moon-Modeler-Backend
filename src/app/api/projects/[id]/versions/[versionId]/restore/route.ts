import { NextRequest } from 'next/server';
import { ProjectsController } from '@/controllers/projects.controller';

export async function POST(req: NextRequest, context: { params: { id: string; versionId: string } }) {
    return ProjectsController.restoreVersion(req, context);
}
