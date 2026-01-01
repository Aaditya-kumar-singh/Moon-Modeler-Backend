import { mongoPrisma } from '@/common/mongo.service';
import { ApiError } from '@/common/errors/api.error';
import { TeamRole } from '@prisma/client-mongo';

export class TeamsService {

    async createTeam(userId: string, name: string) {
        // Run sequentially instead of transaction to support non-ReplicaSet MongoDB
        const team = await mongoPrisma.team.create({
            data: { name }
        });

        try {
            await mongoPrisma.teamToken.create({
                data: {
                    teamId: team.id,
                    userId: userId,
                    role: 'OWNER'
                }
            });
        } catch (error) {
            // Rollback (manual)
            await mongoPrisma.team.delete({ where: { id: team.id } });
            throw error;
        }

        return team;
    }

    async getUserTeams(userId: string) {
        const tokens = await mongoPrisma.teamToken.findMany({
            where: { userId },
            include: { team: true }
        });

        // Enrich with member count maybe?
        return tokens.map(token => ({
            ...token.team,
            role: token.role
        }));
    }

    async getTeamMembers(teamId: string, userId: string) {
        // Verify user is part of the team
        const membership = await mongoPrisma.teamToken.findFirst({
            where: { teamId, userId }
        });
        if (!membership) throw ApiError.forbidden('Not a member of this team');

        const members = await mongoPrisma.teamToken.findMany({
            where: { teamId },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        return members.map(m => ({
            id: m.userId,
            name: m.user?.name || 'Unknown',
            email: m.user?.email || 'No Email',
            role: m.role
        }));
    }

    async inviteMember(teamId: string, inviterId: string, email: string, role: TeamRole = 'VIEWER') {
        // 1. Verify inviter has permission (OWNER or EDITOR)
        const inviter = await mongoPrisma.teamToken.findFirst({
            where: { teamId, userId: inviterId }
        });

        if (!inviter || (inviter.role !== 'OWNER' && inviter.role !== 'EDITOR')) {
            throw ApiError.forbidden('Insufficient permissions to invite members');
        }

        // 2. Find User by Email
        const userToAdd = await mongoPrisma.user.findUnique({
            where: { email }
        });

        if (!userToAdd) {
            throw ApiError.notFound('User', email);
            // In a real app, we'd create a pending invitation record here if user doesn't exist.
        }

        // 3. Check if already member
        const existing = await mongoPrisma.teamToken.findFirst({
            where: { teamId, userId: userToAdd.id }
        });
        if (existing) {
            throw ApiError.conflict('User is already a member of this team');
        }

        // 4. Add Member
        return mongoPrisma.teamToken.create({
            data: {
                teamId,
                userId: userToAdd.id,
                role
            }
        });
    }
}

export const teamsService = new TeamsService();
