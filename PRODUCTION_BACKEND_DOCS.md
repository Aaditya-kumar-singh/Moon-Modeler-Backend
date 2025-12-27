# Moon Modeler - Complete Backend System Specification

This document summarizes the **Production Architecture** for the Moon Modeler backend. It incorporates enterprise-grade patterns including RBAC, Thin Controllers, Observability, and Secure Reverse Engineering.

---

## 1. 🏗️ Architectural Principles

### 1.1 **The "Thin API / Fat Service" Rule**
*   **API Routes (`src/app/api`)**: MUST NOT contain business logic. They only:
    1.  Parse the Request.
    2.  Validate Input (Zod).
    3.  Call the Service.
    4.  Return Standard Response.
*   **Services (`src/modules`)**: Contain all business rules, database calls, and error handling.

### 1.2 **Data Flow**
`Request` → `API Route (Wrapper)` → `Controller (Logic)` → `Service (Business Rules)` → `Helper (Prisma)` → `Database`

---

## 2. 📂 File Structure Specification

```
backend/
├── prisma/
│   └── schema.prisma           # [MODEL] User, Project, Team, ProjectVersion
├── src/
│   ├── app/
│   │   └── api/                # [ROUTER CONFIG] - Thin Wrappers
│   │       ├── projects/
│   │       │   └── route.ts    # Calls ProjectsController
│   │       ├── import/
│   │       │   └── mysql/
│   │       │       └── route.ts # Calls ImportController
│   │       └── ...
│   ├── controllers/            # [CONTROLLERS] - Request Handling Logic
│   │   ├── projects.controller.ts
│   │   └── import.controller.ts
│   ├── services/               # [SERVICES] - Business Logic (Flattened)
│   │   ├── projects.service.ts
│   │   ├── projects.validator.ts
│   │   ├── mysql.connector.ts
│   │   └── ...
│   ├── common/                 # [KERNEL]
│   │   ├── helpers/
│   │   │   ├── base.helper.ts  
│   │   │   └── permission.helper.ts 
│   │   ├── lib/
│   │   │   ├── ssh-tunnel.lib.ts
│   │   │   └── logger.ts       
│   │   └── utils/
│   │       └── response.util.ts
│   ├── jobs/                   # [ASYNC TASKS]
│   │   └── import.job.ts
│   └── tests/                  # [TESTING]
│       ├── factories/          
│       ├── services/
│       └── api/
└── .env
```

---

## 3. �️ Security & Validation Strategy

### 3.1 Input Validation (Zod)
Every module must have a `*.validator.ts`.
*   **Projects**: Validate Name, Type.
*   **Teams**: Validate Member emails, Roles.
*   **Import**: Validate Host, Port, Credentials.

### 3.2 JSON Sanitization (Critical)
Since we store diagrams as JSON, we must prevent:
*   **DoS Attacks**: Enforce Max JSON size (e.g., 5MB).
*   **Injection**: Recursively scan and remove keys like `__proto__`, `constructor` (Prototype Pollution).
*   **Executable Strings**: Ensure no `eval()` compatible strings in critical fields.

---

## 4. 👥 Team & Access Control (RBAC)

### 4.1 Roles
Defined in `TeamMember` (model):
*   **OWNER**: Can delete team, manage billing, all access.
*   **EDITOR**: Can create/edit projects, restore versions.
*   **VIEWER**: Read-only access to projects.

### 4.2 ownership Rules (`permission.helper.ts`)
*   **Delete Project**: Only `OWNER` or Project Creator.
*   **Restore Version**: `OWNER` or `EDITOR`.
*   **Invite User**: `OWNER` or `EDITOR`.

### 3.3 `projects.validator.ts`
**Path**: `src/services/projects.validator.ts`
**Purpose**: Ensures the JSON content is valid "Moon Modeler" schema.
**Methods**:
*   `validateDiagram(json: any): boolean`
    *   Checks if `nodes` is array.
    *   Checks if `edges` is array.
    *   Sanitizes malicious inputs.

---

## 4. 🧩 Services (Business Logic)

### 4.1 `ProjectsService`
Path: `src/services/projects.service.ts`
**Methods**:
*   `createVersion(projectId)`: Saving a snapshot to `ProjectVersion`.
*   `restoreVersion(versionId)`: Overwriting `Project.content` with `Version.content`.

### 4.2 `TeamsService` ([NEW])
Path: `src/services/teams.service.ts`
**Methods**:
*   `createTeam(name, ownerId)`
*   `addMember(teamId, userId)`

### 4.3 `MysqlConnector` (Reverse Engineering)
**Path**: `src/services/mysql.connector.ts`

---

## 5. 🌐 API Endpoints (The Interface)

### 5.1 Auth
*   **POST** `/api/auth/register` (Handled by AuthController)
*   **POST** `/api/auth/login` (NextAuth)

### 5.2 Projects
*   **GET** `/api/projects`: List projects.
*   **POST** `/api/projects`: Create project.
*   **GET** `/api/projects/[id]`: Get diagram.
*   **PATCH** `/api/projects/[id]`: Update diagram (Auto-save).

### 5.3 Import (Reverse Engineering)
*   **POST** `/api/import/mysql`: Connect & Extract Schema.

---

## 6. Intelligent Versioning

### 6.1 Auto-save Strategy
To prevent storage bloat, we do NOT save every keystroke.
1.  **Checksum**: Calculate `SHA256` hash of `content`.
2.  **Logic**: Only create a new `ProjectVersion` if:
    *   Hash is different from latest version.
    *   AND (Time > 5 minutes since last save OR User clicked "Save Now").

### 6.2 Soft Restore
Never overwrite `Project.content` blindly.
1.  Save current state as a "Backup Version".
2.  Apply the older version to `Project.content`.
3.  Log the restoration event.

---

## 7. 🔌 Secure Reverse Engineering

### 7.1 SSH Tunnel Lifecycle
Accessing private user DBs requires strict resource management.
```typescript
try {
  tunnel = await createTunnel(config);
  db = await connect(tunnel.localPort);
  schema = await db.extract();
} finally {
  await db.close();
  await tunnel.close(); // ALWAYS enforce closure
}
```

### 7.2 Standardized Result
The Import API always returns:
```typescript
{
  schema: DiagramJSON,
  warnings: ["Skipped table 'logs' (no primary key)"],
  unsupportedFeatures: ["Stored Procedures"]
}
```

---

## 7. 📊 Observability & DX

### `Project`
*   `id` (String, CUID): Primary Key
*   `name` (String)
*   `type` (Enum): `MONGODB` | `MYSQL`
*   `content` (Json): Stores the full React Flow diagram state (Nodes/Edges).
*   `version` (Int): @default(0) For Optimistic Locking 🔒
*   `userId` (String): Foreign Key

### 7.1 Centralized Logger (`common/lib/logger.ts`)
We log critical events for debugging:
*   `SSH_CONNECTION_OPEN` / `CLOSE`
*   `IMPORT_FAILED` (with safe error message)
*   `VERSION_RESTORED` (by User ID)
*   **Sanitized**: Never log connection strings or passwords. 

### 7.2 Error Standardization
All errors thrown by services must match:
```typescript
class ApiError extends Error {
  constructor(code: string, message: string, status: number) {}
}
```
The Global Filter catches this and returns:
```json
{ "error": { "code": "PROJECT_NOT_FOUND", "message": "..." } }
```

### 7.3 Testing
*   **Unit**: Test `Validators` against malicious payloads.
*   **Integration**: Test `ProjectsService` versioning logic (mock DB).
*   **End-to-End**: Test SSH failure scenarios (use mock SSH server).

---

## 8. 🧯 Secrets & Configuration

### 8.1 Secrets Management
*   **No Raw Values**: `.env` is for local dev only.
*   **Encrypted Secrets**: In production, secrets (DB_URL, SSH_KEYS) are injected via encrypted environment variables (e.g., AWS Secrets Manager, Vercel Env).
*   **Log Sanitization**: The Logger MUST strip any key resembling `password`, `secret`, `key`, `token` before writing to transport.

---

## 9. 📜 Audit Logging (Compliance)

Separate from debug logs, **Audit Logs** record "Who did What and When" for security compliance.

### 9.1 Data Model (`AuditLog`)
*   `id`: CUID
*   `userId`: Actor
*   `action`: `PROJECT_DELETED`, `VERSION_RESTORED`, `MEMBER_ADDED`
*   `resourceId`: ID of the target
*   `metadata`: JSON (diff or details)
*   `timestamp`: DateTime

### 9.2 Implementation
*   **Triggers**: Called inside Services after successful critical actions.
*   **Storage**: Database table (for durability).

---

## 10. 🌐 API Design Polish

### 10.1 Versioning
To future-proof the application, all routes should be logically versioned, even if physically in the same app folder structure.
*   **Code**: `src/app/api/v1/...`
*   **Strategy**: Breaking changes require a new `v2` path.

### 10.2 Documentation (OpenAPI)
*   **Spec**: Auto-generated Swagger/OpenAPI JSON.
*   **Benefit**: Frontend generates typed clients automatically. Clients (Teams) understand the contract clearly.

---

## 11. ⏳ Asynchronous Processing (Jobs)

For tasks > 500ms (Imports, Large Parses), we must not block the API response.

### 11.1 Job Abstraction (`common/jobs/`)
Since we are serverless-first (Next.js), we use a lightweight Job interface.
*   **Immediate**: `await job.execute()`
*   **Background**: `waitUntil(job.execute())` (Vercel) or specialized Queue (BullMQ/Redis) if easier.

### 11.2 Use Cases
*   **Huge SQL Imports**: Reading 1000 tables via SSH.
*   **PDF Generation**: Exporting large diagrams.

---

## 12. �️ Reliability & Integrity

### 12.1 Transactional Boundaries
**Rule**: Any service method involving > 1 write MUST use a transaction.
```typescript
await prisma.$transaction(async (tx) => {
    const project = await tx.project.create(...);
    await tx.auditLog.create({ ... }); // If this fails, project creation rolls back
});
```
*   **Crucial for**: `restoreVersion`, `createProject`, `addTeamMember`.

### 12.2 Idempotency
To prevent duplicate actions on network retries, mutating APIs (`POST`, `PATCH`) support `Idempotency-Key` headers.
*   **Behavior**: If the same key is seen within 24h, return the previous successful response without re-executing logic.

### 12.3 Rate Limiting
Prevent abuse using standard token buckets (or Vercel KV).
*   **Auth**: 5 attempts / 15 mins.
*   **Import**: 10 requests / hour (due to SSH load).
*   **Save**: 60 requests / minute (per user).

### 12.4 Concurrency Control (Optimistic Locking)
Prevent "Last Write Wins" overwrites when multiple users edit.
*   **Model Update**: Add `version: Int @default(0)` to `Project`.
*   **Logic**:
    1.  Client sends `version: 5` in `PATCH` body.
    2.  Server checks: `UPDATE Project SET ... WHERE id = X AND version = 5`.
    3.  If 0 rows updated -> **409 Conflict** (Reload required).

---

## 13. �🛠️ Developer Experience (DX)

### 13.1 Test Data Factories (`tests/factories/`)
Instead of manual JSON mocks:
```typescript
const user = await UserFactory.create({ email: 'test@moon.io' });
const project = await ProjectFactory.create({ owner: user });
```
Makes tests readable and resilient to schema changes.

### 13.2 Quality Gates
*   **ESLint**: Strict rules (no-explicit-any).
*   **Prettier**: Auto-format on save.
*   **Git Hooks**: Pre-commit linting (Husky).
