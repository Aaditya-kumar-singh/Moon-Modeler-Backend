import { NextRequest } from 'next/server';
import { ProjectsController } from '@/controllers/projects.controller';

export async function GET(req: NextRequest) {
    return ProjectsController.list(req);
}

export async function POST(req: NextRequest) {
    return ProjectsController.create(req);
}
