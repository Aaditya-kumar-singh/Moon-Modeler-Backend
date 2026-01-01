import { NextRequest } from 'next/server';
import { teamsService } from '@/services/teams.service';
import { ResponseUtil } from '@/common/utils/response.util';
import { z } from 'zod';

// Helper to get User ID from JWT (Moved to a shared util ideally, but repeating for speed)
const getUserId = (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return null;
    try {
        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId;
    } catch (e) {
        return null;
    }
};

const CreateTeamSchema = z.object({
    name: z.string().min(1).max(50)
});

const InviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(['OWNER', 'EDITOR', 'VIEWER']).optional()
});

export class TeamsController {

    static async list(req: NextRequest) {
        try {
            const userId = getUserId(req);
            if (!userId) return ResponseUtil.error('Unauthorized', 401, 'UNAUTHORIZED');

            const teams = await teamsService.getUserTeams(userId);
            return ResponseUtil.success(teams);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async create(req: NextRequest) {
        try {
            const userId = getUserId(req);
            if (!userId) return ResponseUtil.error('Unauthorized', 401, 'UNAUTHORIZED');

            const body = await req.json();
            const { name } = CreateTeamSchema.parse(body);

            const team = await teamsService.createTeam(userId, name);
            return ResponseUtil.success(team, 201);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async getMembers(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const userId = getUserId(req);
            if (!userId) return ResponseUtil.error('Unauthorized', 401, 'UNAUTHORIZED');

            const members = await teamsService.getTeamMembers(params.id, userId);
            return ResponseUtil.success(members);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }

    static async inviteMember(req: NextRequest, { params }: { params: { id: string } }) {
        try {
            const userId = getUserId(req);
            if (!userId) return ResponseUtil.error('Unauthorized', 401, 'UNAUTHORIZED');

            const body = await req.json();
            const { email, role } = InviteMemberSchema.parse(body);

            const result = await teamsService.inviteMember(params.id, userId, email, role);
            return ResponseUtil.success(result, 201);
        } catch (error) {
            return ResponseUtil.handleError(error);
        }
    }
}
