import { NextRequest } from 'next/server';
import { ResponseUtil } from '@/common/utils/response.util';
import { z } from 'zod';
import { ImportMysqlSchema } from '@/services/import.validator';
import { logSafe } from '@/common/lib/logger';
import { MysqlImportJob } from '@/jobs/mysql-import.job';
import { JobExecutor, JobStatus } from '@/common/jobs/base.job';

export class ImportController {
    static async importMysql(req: NextRequest) {
        const { RateLimitService, RateLimitPresets } = await import('@/common/middleware/rate-limit.service');

        return RateLimitService.middleware(req, RateLimitPresets.IMPORT, async () => {
            try {
                const body = await req.json();
                const config = ImportMysqlSchema.parse(body);

                // Create import job
                const job = new MysqlImportJob();

                // Execute with auto strategy (background if > 500ms estimated)
                // For MySQL imports, we estimate based on whether SSH is used
                const estimatedDuration = config.ssh ? 2000 : 800; // SSH adds overhead

                const result = await JobExecutor.executeAuto(job, config, estimatedDuration);

                // Check if job was executed immediately or in background
                if ('jobId' in result && result.status === JobStatus.PENDING) {
                    // Background execution - return job ID for polling
                    return ResponseUtil.success({
                        jobId: result.jobId,
                        status: result.status,
                        message: 'Import started in background. Poll /api/v1/jobs/{jobId} for status.'
                    }, 202); // 202 Accepted
                } else {
                    // Immediate execution - return result (type narrowed to JobResult)
                    const jobResult = result as { status: JobStatus; data?: any; error?: string };

                    if (jobResult.status === JobStatus.COMPLETED && jobResult.data) {
                        // Audit log
                        const { audit } = await import('@/common/services/audit.service');
                        // Note: userId should come from auth, using 'system' for now
                        await audit.schemaImported('system', config.database, jobResult.data.tableCount);

                        return ResponseUtil.success({
                            schema: jobResult.data.schema,
                            warnings: jobResult.data.warnings,
                            unsupportedFeatures: jobResult.data.unsupportedFeatures
                        });
                    } else {
                        return ResponseUtil.error(jobResult.error || 'Import failed', 500, 'IMPORT_FAILED');
                    }
                }

            } catch (error: any) {
                logSafe('error', 'IMPORT_FAILED', {
                    errorMessage: error.message,
                });

                if (error instanceof z.ZodError) {
                    return ResponseUtil.error(JSON.stringify(error.issues), 400, 'VALIDATION_ERROR');
                }
                return ResponseUtil.handleError(error);
            }
        });
    }
}
