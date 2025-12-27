import { NextRequest } from 'next/server';
import { ProjectsController } from '@/controllers/projects.controller';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    return ProjectsController.export(req, { params });
}
