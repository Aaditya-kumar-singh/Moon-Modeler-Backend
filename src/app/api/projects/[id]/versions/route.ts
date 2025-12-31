import { NextRequest } from 'next/server';
import { ProjectsController } from '@/controllers/projects.controller';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
    return ProjectsController.getVersions(req, context);
}
