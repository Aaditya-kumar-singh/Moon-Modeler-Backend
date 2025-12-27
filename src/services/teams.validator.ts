import { z } from 'zod';

// Decouple from Prisma Client to avoid IDE sync issues with generated types
export const TeamRoleEnum = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
export type TeamRoleType = z.infer<typeof TeamRoleEnum>;

export const CreateTeamSchema = z.object({
    name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
});

export const AddMemberSchema = z.object({
    email: z.string().email('Invalid email address'),
    role: TeamRoleEnum.default('VIEWER'),
});

export const UpdateMemberRoleSchema = z.object({
    role: TeamRoleEnum,
});
