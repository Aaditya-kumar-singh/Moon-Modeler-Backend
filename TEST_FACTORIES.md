# Test Data Factories

## 🎯 Overview

Test data factories provide a clean, maintainable way to create test data. Instead of manually crafting JSON objects or database records, factories generate realistic test data with sensible defaults.

## 📁 Location

```
src/tests/factories/
└── index.ts  # All factories
```

## 🏭 Available Factories

### 1. UserFactory

Create test users with automatic email generation.

```typescript
import { UserFactory } from '@/tests/factories';

// Basic user
const user = await UserFactory.create();
// { id: 'cuid...', email: 'user1@test.com', name: 'Test User 1' }

// Custom user
const admin = await UserFactory.create({
    email: 'admin@company.com',
    name: 'Admin User'
});

// Multiple users
const users = await UserFactory.createMany(5);
```

### 2. ProjectFactory

Create test projects with optional relationships.

```typescript
import { ProjectFactory, UserFactory } from '@/tests/factories';

// Basic project (creates owner automatically)
const project = await ProjectFactory.create();

// Project with specific owner
const user = await UserFactory.create();
const project = await ProjectFactory.create({ owner: user });

// Project with diagram content
const project = await ProjectFactory.createWithDiagram({
    owner: user,
    nodes: [
        { id: '1', type: 'tableNode', data: { name: 'users' } },
        { id: '2', type: 'tableNode', data: { name: 'posts' } }
    ],
    edges: [
        { id: 'e1-2', source: '1', target: '2' }
    ]
});

// Project with version history
const project = await ProjectFactory.createWithVersions(5); // 5 versions
```

### 3. TeamFactory

Create test teams with members.

```typescript
import { TeamFactory, UserFactory } from '@/tests/factories';

// Basic team (creates owner automatically)
const team = await TeamFactory.create();

// Team with specific owner
const owner = await UserFactory.create();
const team = await TeamFactory.create({ owner });

// Team with multiple members
const team = await TeamFactory.createWithMembers(5); // 1 owner + 4 members
```

### 4. AuditLogFactory

Create test audit logs.

```typescript
import { AuditLogFactory, UserFactory } from '@/tests/factories';

// Basic audit log
const user = await UserFactory.create();
const log = await AuditLogFactory.create({ userId: user.id });

// Multiple audit logs
const logs = await AuditLogFactory.createMany(user.id, 10);
```

## 🛠️ Factory Helper

Utility functions for test management.

```typescript
import { FactoryHelper } from '@/tests/factories';

// Reset all counters (between tests)
FactoryHelper.resetAll();

// Clean up all test data
await FactoryHelper.cleanupAll();

// Create complete scenario
const { owner, team, project } = await FactoryHelper.createScenario();
```

## 📝 Usage in Tests

### Before/After Hooks

```typescript
import { describe, it, beforeEach, afterEach } from '@jest/globals';
import { UserFactory, ProjectFactory, FactoryHelper } from '@/tests/factories';

describe('ProjectsService', () => {
    beforeEach(() => {
        FactoryHelper.resetAll(); // Reset counters
    });

    afterEach(async () => {
        await FactoryHelper.cleanupAll(); // Clean database
    });

    it('should create project', async () => {
        const user = await UserFactory.create();
        const project = await ProjectFactory.create({ owner: user });
        
        expect(project.userId).toBe(user.id);
    });
});
```

### Integration Tests

```typescript
describe('saveDiagram - Optimistic Locking', () => {
    it('should throw conflict on version mismatch', async () => {
        const user = await UserFactory.create();
        const project = await ProjectFactory.create({ owner: user });

        // Simulate concurrent update
        await service.saveDiagram(project.id, { nodes: [] }, user.id);

        // Try to save with stale version
        await expect(
            service.saveDiagram(project.id, { nodes: [] }, user.id, 0)
        ).rejects.toThrow('modified by another user');
    });
});
```

### E2E Tests

```typescript
describe('API - Projects', () => {
    it('should list user projects', async () => {
        const user = await UserFactory.create();
        await ProjectFactory.create({ owner: user, name: 'Project 1' });
        await ProjectFactory.create({ owner: user, name: 'Project 2' });

        const response = await fetch('/api/v1/projects', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });

        const { data } = await response.json();
        expect(data).toHaveLength(2);
    });
});
```

## ✨ Benefits

### 1. **Readability**

**Before** (manual mocks):
```typescript
const project = await prisma.project.create({
    data: {
        id: 'test-id-123',
        name: 'Test Project',
        type: 'MYSQL',
        content: { nodes: [], edges: [] },
        version: 0,
        userId: 'user-id-456',
        createdAt: new Date(),
        updatedAt: new Date()
    }
});
```

**After** (factories):
```typescript
const project = await ProjectFactory.create({ name: 'Test Project' });
```

### 2. **Resilience to Schema Changes**

If you add a new required field to `Project`:

**Manual mocks**: Update every test ❌
**Factories**: Update factory once ✅

### 3. **Relationships Made Easy**

```typescript
// Create entire scenario in one line
const { owner, team, project } = await FactoryHelper.createScenario();

// vs manually:
const owner = await prisma.user.create({ data: {...} });
const team = await prisma.team.create({ data: {...} });
await prisma.teamToken.create({ data: {...} });
const project = await prisma.project.create({ data: {...} });
```

### 4. **Consistent Test Data**

All factories use the same patterns:
- Auto-incrementing counters for uniqueness
- Sensible defaults
- Optional overrides
- Automatic relationship creation

## 🎨 Customization

### Override Defaults

```typescript
const project = await ProjectFactory.create({
    name: 'Custom Name',
    type: 'MONGODB',
    content: { custom: 'data' }
});
```

### Create Related Data

```typescript
const user = await UserFactory.create();
const team = await TeamFactory.create({ owner: user });
const project = await ProjectFactory.create({ team });
```

### Build Complex Scenarios

```typescript
// Multi-user collaboration scenario
const owner = await UserFactory.create({ email: 'owner@test.com' });
const editor = await UserFactory.create({ email: 'editor@test.com' });
const viewer = await UserFactory.create({ email: 'viewer@test.com' });

const team = await TeamFactory.create({ owner });
await prisma.teamToken.create({
    data: { teamId: team.id, userId: editor.id, role: 'EDITOR' }
});
await prisma.teamToken.create({
    data: { teamId: team.id, userId: viewer.id, role: 'VIEWER' }
});

const project = await ProjectFactory.createWithDiagram({ team });
```

## 🧪 Testing Best Practices

### 1. **Isolate Tests**

```typescript
afterEach(async () => {
    await FactoryHelper.cleanupAll(); // Clean slate for each test
});
```

### 2. **Reset Counters**

```typescript
beforeEach(() => {
    FactoryHelper.resetAll(); // Predictable IDs/emails
});
```

### 3. **Use Descriptive Overrides**

```typescript
// Good
const admin = await UserFactory.create({ email: 'admin@test.com' });
const project = await ProjectFactory.create({ name: 'Admin Project' });

// Avoid
const user = await UserFactory.create();
const project = await ProjectFactory.create();
```

### 4. **Test Relationships**

```typescript
it('should include team in project response', async () => {
    const { team, project } = await FactoryHelper.createScenario();
    
    const fetched = await service.getObjectById(project.id);
    expect(fetched.team.id).toBe(team.id);
});
```

## 🔧 Extending Factories

### Add New Factory

```typescript
export class CommentFactory {
    private static counter = 0;

    static async create(overrides: {
        content?: string;
        author?: { id: string };
        project?: { id: string };
    } = {}) {
        this.counter++;

        let authorId = overrides.author?.id;
        if (!authorId) {
            const user = await UserFactory.create();
            authorId = user.id;
        }

        let projectId = overrides.project?.id;
        if (!projectId) {
            const project = await ProjectFactory.create();
            projectId = project.id;
        }

        return prisma.comment.create({
            data: {
                content: overrides.content || `Comment ${this.counter}`,
                authorId,
                projectId,
            }
        });
    }

    static reset() {
        this.counter = 0;
    }
}
```

### Add to FactoryHelper

```typescript
static resetAll() {
    UserFactory.reset();
    ProjectFactory.reset();
    TeamFactory.reset();
    CommentFactory.reset(); // Add new factory
}

static async cleanupAll() {
    await prisma.comment.deleteMany(); // Add cleanup
    await prisma.auditLog.deleteMany();
    // ... rest
}
```

## 📊 Factory Patterns

### 1. **Trait Pattern**

```typescript
static async createAdmin() {
    return this.create({
        email: 'admin@test.com',
        role: 'ADMIN'
    });
}

static async createGuest() {
    return this.create({
        email: 'guest@test.com',
        role: 'GUEST'
    });
}
```

### 2. **Builder Pattern**

```typescript
class ProjectBuilder {
    private data: any = {};

    withName(name: string) {
        this.data.name = name;
        return this;
    }

    withOwner(owner: User) {
        this.data.owner = owner;
        return this;
    }

    async build() {
        return ProjectFactory.create(this.data);
    }
}

// Usage
const project = await new ProjectBuilder()
    .withName('My Project')
    .withOwner(user)
    .build();
```

## 🚀 Performance Tips

### 1. **Batch Creation**

```typescript
// Slow
for (let i = 0; i < 100; i++) {
    await UserFactory.create();
}

// Fast
await UserFactory.createMany(100);
```

### 2. **Reuse Objects**

```typescript
// Create once, reuse
const user = await UserFactory.create();

const project1 = await ProjectFactory.create({ owner: user });
const project2 = await ProjectFactory.create({ owner: user });
const project3 = await ProjectFactory.create({ owner: user });
```

### 3. **Cleanup Strategically**

```typescript
// Clean only what you created
afterEach(async () => {
    await prisma.project.deleteMany({ where: { name: { startsWith: 'Test' } } });
});

// vs cleaning everything
afterEach(async () => {
    await FactoryHelper.cleanupAll(); // Slower
});
```

## 📚 Resources

- [Factory Bot (Ruby inspiration)](https://github.com/thoughtbot/factory_bot)
- [Fishery (TypeScript factories)](https://github.com/thoughtbot/fishery)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
