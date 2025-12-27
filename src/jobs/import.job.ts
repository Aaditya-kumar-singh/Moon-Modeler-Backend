import { logger } from '@/common/lib/logger';

export interface Job {
    name: string;
    execute(data: any): Promise<void>;
}

export class ImportJob implements Job {
    name = 'ImportDatabaseSchema';

    async execute(data: any): Promise<void> {
        // Placeholder for async execution logic
        // This is where we would hook into queues like BullMQ later
        logger.info(`Starting Job: ${this.name}`, { data });

        await new Promise(resolve => setTimeout(resolve, 2000)); // Mock work

        logger.info(`Job Finished: ${this.name}`);
    }
}
