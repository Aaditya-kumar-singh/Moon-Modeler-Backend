import { NextRequest } from 'next/server';
import { TeamsController } from '@/controllers/teams.controller';

export async function GET(req: NextRequest) {
    return TeamsController.list(req);
}

export async function POST(req: NextRequest) {
    return TeamsController.create(req);
}
