import { NextRequest } from 'next/server';
import { TeamsController } from '@/controllers/teams.controller';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
    return TeamsController.getMembers(req, context);
}

export async function POST(req: NextRequest, context: { params: { id: string } }) {
    return TeamsController.inviteMember(req, context);
}
