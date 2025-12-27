import { logSafe } from '@/common/lib/logger';

/**
 * Job Status Enum
 */
export enum JobStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

/**
 * Job Result Interface
 */
export interface JobResult<T = any> {
    status: JobStatus;
    data?: T;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
}

/**
 * Base Job Interface
 * 
 * All background jobs must implement this interface.
 * Provides a consistent API for executing long-running tasks.
 */
export interface IJob<TInput = any, TOutput = any> {
    /**
     * Unique job identifier
     */
    id: string;

    /**
     * Job name for logging and monitoring
     */
    name: string;

    /**
     * Execute the job
     * @param input Job input parameters
     * @returns Job result
     */
    execute(input: TInput): Promise<JobResult<TOutput>>;
}

/**
 * Abstract Base Job Class
 * 
 * Provides common functionality for all jobs:
 * - Automatic logging
 * - Error handling
 * - Status tracking
 * - Execution timing
 */
export abstract class BaseJob<TInput = any, TOutput = any> implements IJob<TInput, TOutput> {
    public readonly id: string;
    public readonly name: string;

    constructor(name: string) {
        this.id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
    }

    /**
     * Execute the job with automatic error handling and logging
     */
    async execute(input: TInput): Promise<JobResult<TOutput>> {
        const startedAt = new Date();

        logSafe('info', `JOB_STARTED: ${this.name}`, {
            jobId: this.id,
            jobName: this.name,
        });

        try {
            const data = await this.run(input);

            const completedAt = new Date();
            const duration = completedAt.getTime() - startedAt.getTime();

            logSafe('info', `JOB_COMPLETED: ${this.name}`, {
                jobId: this.id,
                jobName: this.name,
                duration: `${duration}ms`,
            });

            return {
                status: JobStatus.COMPLETED,
                data,
                startedAt,
                completedAt,
            };
        } catch (error) {
            const completedAt = new Date();
            const duration = completedAt.getTime() - startedAt.getTime();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            logSafe('error', `JOB_FAILED: ${this.name}`, {
                jobId: this.id,
                jobName: this.name,
                error: errorMessage,
                duration: `${duration}ms`,
            });

            return {
                status: JobStatus.FAILED,
                error: errorMessage,
                startedAt,
                completedAt,
            };
        }
    }

    /**
     * Implement this method with your job logic
     */
    protected abstract run(input: TInput): Promise<TOutput>;
}

/**
 * Job Executor
 * 
 * Handles job execution strategies:
 * - Immediate: Blocks until completion (for fast jobs)
 * - Background: Non-blocking (for slow jobs)
 */
export class JobExecutor {
    /**
     * Execute job immediately (blocking)
     * Use for jobs < 500ms
     */
    static async executeImmediate<TInput, TOutput>(
        job: IJob<TInput, TOutput>,
        input: TInput
    ): Promise<JobResult<TOutput>> {
        return job.execute(input);
    }

    /**
     * Execute job in background (non-blocking)
     * Use for jobs > 500ms
     * 
     * On Vercel: Uses waitUntil() to extend execution
     * On other platforms: Could use BullMQ/Redis queue
     */
    static async executeBackground<TInput, TOutput>(
        job: IJob<TInput, TOutput>,
        input: TInput
    ): Promise<{ jobId: string; status: JobStatus }> {
        const jobId = job.id;

        // Start job execution (don't await)
        const execution = job.execute(input);

        // On Vercel, use waitUntil to extend execution beyond response
        if (typeof (globalThis as any).waitUntil === 'function') {
            (globalThis as any).waitUntil(execution);
        } else {
            // Fallback: Execute in background (fire and forget)
            execution.catch(error => {
                logSafe('error', 'BACKGROUND_JOB_ERROR', {
                    jobId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });
        }

        return {
            jobId,
            status: JobStatus.PENDING,
        };
    }

    /**
     * Determine execution strategy based on estimated duration
     */
    static async executeAuto<TInput, TOutput>(
        job: IJob<TInput, TOutput>,
        input: TInput,
        estimatedDurationMs: number = 1000
    ): Promise<JobResult<TOutput> | { jobId: string; status: JobStatus }> {
        if (estimatedDurationMs < 500) {
            return this.executeImmediate(job, input);
        } else {
            return this.executeBackground(job, input);
        }
    }
}
