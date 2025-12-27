import { TeamRoleType, TeamRoleEnum } from '@/services/teams.validator';

// Map Prisma/DB Strings to safe Enum Types
const TeamRole = TeamRoleEnum.enum;

export class PermissionHelper {

    // Matrix defining who can do what
    private static permissions = {
        DELETE_TEAM: [TeamRole.OWNER],
        MANAGE_BILLING: [TeamRole.OWNER],
        ADD_MEMBER: [TeamRole.OWNER, TeamRole.EDITOR],
        CREATE_PROJECT: [TeamRole.OWNER, TeamRole.EDITOR],
        EDIT_PROJECT: [TeamRole.OWNER, TeamRole.EDITOR],
        RESTORE_VERSION: [TeamRole.OWNER, TeamRole.EDITOR],
        VIEW_PROJECT: [TeamRole.OWNER, TeamRole.EDITOR, TeamRole.VIEWER],
    };

    /**
     * Checks if a role has the required permission.
     */
    static hasPermission(role: TeamRoleType, action: keyof typeof PermissionHelper.permissions): boolean {
        return (this.permissions[action] as TeamRoleType[]).includes(role);
    }

    /**
     * Throws an error if the role does not have permission.
     */
    static check(role: TeamRoleType, action: keyof typeof PermissionHelper.permissions) {
        if (!this.hasPermission(role, action)) {
            throw new Error(`FORBIDDEN: You do not have permission to ${action}`);
        }
    }
}
