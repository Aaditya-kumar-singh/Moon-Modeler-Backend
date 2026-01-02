
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    console.log('Starting cleanup of orphaned TeamTokens...');

    // 1. Fetch all TeamTokens
    const tokens = await prisma.teamToken.findMany();
    console.log(`Found ${tokens.length} total tokens.`);

    let deletedCount = 0;

    for (const token of tokens) {
        // Check if Team exists
        const team = await prisma.team.findUnique({
            where: { id: token.teamId }
        });

        if (!team) {
            console.log(`Deleting orphan token ${token.id} (Team ${token.teamId} missing)`);
            await prisma.teamToken.delete({
                where: { id: token.id }
            });
            deletedCount++;
            continue;
        }

        // Check if User exists
        const user = await prisma.user.findUnique({
            where: { id: token.userId }
        });

        if (!user) {
            console.log(`Deleting orphan token ${token.id} (User ${token.userId} missing)`);
            await prisma.teamToken.delete({
                where: { id: token.id }
            });
            deletedCount++;
        }
    }

    console.log(`\nCleanup complete. Deleted ${deletedCount} orphaned tokens.`);
}

cleanup()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
