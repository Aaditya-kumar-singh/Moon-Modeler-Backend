# Asynchronous Job Processing

## 🎯 Overview

For operations that take > 500ms (imports, large parses, PDF generation), we use an asynchronous job system to prevent API timeouts and improve user experience.

## 📁 Architecture

```
src/
├── common/jobs/
│   └── base.job.ts          # Base job abstraction
└── jobs/
    └── mysql-import.job.ts  # MySQL import implementation
```

## 🔧 Job System Components

### 1. Base Job Interface

```typescript
interface IJob<TInput, TOutput> {
    id: string;
    name: string;
    execute(input: TInput): Promise<JobResult<TOutput>>;
}
```

### 2. Job Executor Strategies

**Immediate Execution** (< 500ms):
```typescript
const result = await JobExecutor.executeImmediate(job, input);
// Returns: JobResult<T> with data
```

**Background Execution** (> 500ms):
```typescript
const result = await JobExecutor.executeBackground(job, input);
// Returns: { jobId, status: 'PENDING' }
```

**Auto Strategy** (recommended):
```typescript
const result = await JobExecutor.executeAuto(job, input, estimatedMs);
// Automatically chooses immediate or background based on estimate
```

## 📝 Creating a New Job

### Step 1: Define Job Class

```typescript
import { BaseJob } from '@/common/jobs/base.job';

export interface MyJobInput {
    // Input parameters
}

export interface MyJobOutput {
    // Output data
}

export class MyJob extends BaseJob<MyJobInput, MyJobOutput> {
    constructor() {
        super('my-job-name');
    }

    protected async run(input: MyJobInput): Promise<MyJobOutput> {
        // Your job logic here
        return { /* result */ };
    }
}
```

### Step 2: Use in Controller

```typescript
import { MyJob } from '@/jobs/my-job';
import { JobExecutor, JobStatus } from '@/common/jobs/base.job';

export class MyController {
    static async myEndpoint(req: NextRequest) {
        const job = new MyJob();
        const input = await req.json();
        
        // Auto execution
        const result = await JobExecutor.executeAuto(job, input, 1000);
        
        if ('jobId' in result) {
            // Background execution
            return ResponseUtil.success({
                jobId: result.jobId,
                status: result.status,
                message: 'Job started. Poll /api/v1/jobs/{jobId} for status.'
            }, 202);
        } else {
            // Immediate execution
            if (result.status === JobStatus.COMPLETED) {
                return ResponseUtil.success(result.data);
            } else {
                return ResponseUtil.error(result.error, 500);
            }
        }
    }
}
```

## 🌐 Platform Support

### Vercel (Serverless)

Uses `waitUntil()` to extend execution beyond response:

```typescript
// Automatically detected and used
if (typeof globalThis.waitUntil === 'function') {
    globalThis.waitUntil(jobExecution);
}
```

### Traditional Server (Node.js)

For long-running jobs, integrate a queue system:

```typescript
// Install BullMQ
npm install bullmq ioredis

// Create queue
import { Queue } from 'bullmq';

const importQueue = new Queue('imports', {
    connection: { host: 'localhost', port: 6379 }
});

// Add job to queue
await importQueue.add('mysql-import', input);
```

## 📊 Job Status Flow

```
PENDING → RUNNING → COMPLETED
                  ↘ FAILED
```

## 🔍 Monitoring & Logging

Every job automatically logs:

```
JOB_STARTED: mysql-import
  jobId: mysql-import-1234567890-abc123
  jobName: mysql-import

JOB_COMPLETED: mysql-import
  jobId: mysql-import-1234567890-abc123
  duration: 1250ms

// Or on failure:
JOB_FAILED: mysql-import
  jobId: mysql-import-1234567890-abc123
  error: Connection timeout
  duration: 5000ms
```

## 💡 Use Cases

### 1. MySQL Import (Implemented)

```typescript
const job = new MysqlImportJob();
const result = await JobExecutor.executeAuto(job, {
    host: 'db.example.com',
    database: 'mydb',
    // ... config
}, 2000); // Estimated 2s with SSH
```

**Execution:**
- Small DB (< 100 tables): Immediate
- Large DB (> 100 tables): Background

### 2. PDF Export (Future)

```typescript
export class PdfExportJob extends BaseJob<PdfInput, PdfOutput> {
    protected async run(input: PdfInput): Promise<PdfOutput> {
        // Generate PDF from diagram
        const pdf = await generatePdf(input.diagram);
        return { pdfUrl: await uploadToS3(pdf) };
    }
}
```

### 3. Batch Operations (Future)

```typescript
export class BatchDeleteJob extends BaseJob<BatchInput, BatchOutput> {
    protected async run(input: BatchInput): Promise<BatchOutput> {
        const results = [];
        for (const id of input.projectIds) {
            await deleteProject(id);
            results.push({ id, deleted: true });
        }
        return { results };
    }
}
```

## ⚡ Performance Considerations

### Immediate vs Background Thresholds

| Operation | Estimated Time | Strategy |
|-----------|---------------|----------|
| Simple query | < 100ms | Immediate |
| Small import | 200-500ms | Immediate |
| Large import | > 500ms | Background |
| PDF generation | > 1s | Background |
| Batch operations | > 2s | Background |

### Resource Cleanup

Jobs automatically handle cleanup in `finally` blocks:

```typescript
protected async run(input: Input): Promise<Output> {
    const resource = await acquire();
    try {
        return await process(resource);
    } finally {
        await resource.cleanup(); // Always runs
    }
}
```

## 🚀 Best Practices

1. **Estimate conservatively** - Better to go background than timeout
2. **Always cleanup resources** - Use try/finally
3. **Log important events** - Use `logSafe()` for debugging
4. **Handle errors gracefully** - Return meaningful error messages
5. **Test both paths** - Test immediate and background execution
6. **Monitor job duration** - Adjust thresholds based on real data

## 📚 API Response Examples

### Immediate Execution (Fast Job)

**Request:**
```
POST /api/v1/import/mysql
{ "host": "localhost", "database": "small_db" }
```

**Response (200 OK):**
```json
{
  "data": {
    "schema": { "nodes": [...], "edges": [...] },
    "warnings": [],
    "unsupportedFeatures": []
  }
}
```

### Background Execution (Slow Job)

**Request:**
```
POST /api/v1/import/mysql
{ "host": "remote.db", "database": "huge_db", "ssh": {...} }
```

**Response (202 Accepted):**
```json
{
  "data": {
    "jobId": "mysql-import-1234567890-abc123",
    "status": "PENDING",
    "message": "Import started in background. Poll /api/v1/jobs/{jobId} for status."
  }
}
```

**Poll for status:**
```
GET /api/v1/jobs/mysql-import-1234567890-abc123
```

## 🔮 Future Enhancements

1. **Job Status API** - Endpoint to poll job status
2. **WebSocket Updates** - Real-time job progress
3. **Job Queue UI** - Admin dashboard for monitoring
4. **Retry Logic** - Automatic retry on transient failures
5. **Job Prioritization** - High/low priority queues
6. **Rate Limiting** - Prevent job queue overflow
