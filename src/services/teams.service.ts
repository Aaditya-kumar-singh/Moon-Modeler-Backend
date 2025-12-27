import { Team, TeamToken, Prisma } from '@prisma/client';
import { BaseHelper } from '@/common/helpers/base.helper';
import { prisma } from '@/common/prisma.service';
import { CreateTeamSchema, AddMemberSchema, TeamRoleType } from './teams.validator';

export class TeamsService extends BaseHelper<Team> {
    constructor() {
        super(prisma.team);
    }

    async createTeam(name: string, ownerId: string) {
        // Validation
        const validated = CreateTeamSchema.parse({ name });

        return prisma.$transaction(async (tx) => {
            // 1. Create Team
            const team = await tx.team.create({
                data: {
                    name: validated.name as string,
                }
            });

            // 2. Add Owner
            await tx.teamToken.create({
                data: {
                    teamId: team.id,
                    userId: ownerId,
                    role: 'OWNER'
                }
            });

            return team;
        });
    }

    async addMember(teamId: string, email: string, role: any, actorId: string) {
        const validated = AddMemberSchema.parse({ email, role });

        return prisma.$transaction(async (tx) => {
            // 1. Check Permissions
            const actorToken = await tx.teamToken.findFirst({
                where: { teamId, userId: actorId }
            });

            if (!actorToken) throw new Error('FORBIDDEN: You are not a member of this team');

            // Use the Helper to enforce RBAC
            const { PermissionHelper } = await import('@/common/helpers/permission.helper');
            PermissionHelper.check(actorToken.role as TeamRoleType, 'ADD_MEMBER');

            // 2. Find User by Email
            const user = await tx.user.findUnique({ where: { email: validated.email } });
            if (!user) throw new Error('User not found');

            // 3. Add to Team
            const teamToken = await tx.teamToken.create({
                data: {
                    teamId,
                    userId: user.id,
                    role: validated.role
                }
            });

            // 4. Audit log (within same transaction)
            await tx.auditLog.create({
                data: {
                    userId: actorId,
                    action: 'MEMBER_ADDED',
                    resourceId: teamId,
                    metadata: { newMemberId: user.id, role: validated.role } as any,
                }
            });

            return teamToken;
        });
    }
}

export const teamsService = new TeamsService();
