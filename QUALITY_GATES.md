# Quality Gates & Developer Experience

## 🎯 Overview

This project enforces strict code quality standards through automated tooling:
- **ESLint**: Static code analysis with strict TypeScript rules
- **Prettier**: Automatic code formatting
- **Husky**: Git hooks for pre-commit validation
- **lint-staged**: Run linters only on staged files

## 📋 ESLint Configuration

### Strict Rules Enforced

1. **`@typescript-eslint/no-explicit-any`: error**
   - No `any` types allowed in production code
   - Forces proper typing
   - Exception: Test files can use `any`

2. **`@typescript-eslint/explicit-function-return-type`: warn**
   - Functions should have explicit return types
   - Improves code documentation

3. **`@typescript-eslint/no-unused-vars`: error**
   - No unused variables or imports
   - Keeps codebase clean

4. **`@typescript-eslint/no-floating-promises`: error**
   - All promises must be awaited or handled
   - Prevents silent failures

### Running ESLint

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

### ESLint in VS Code

Add to `.vscode/settings.json`:
```json
{
  "eslint.validate": ["typescript", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 🎨 Prettier Configuration

### Code Style

- **Semi-colons**: Yes
- **Quotes**: Single quotes
- **Print width**: 100 characters
- **Tab width**: 4 spaces
- **Trailing commas**: ES5 compatible
- **Arrow parens**: Avoid when possible

### Running Prettier

```bash
# Format all files
npm run format

# Check formatting without changing files
npm run format:check
```

### Prettier in VS Code

Add to `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## 🪝 Git Hooks (Husky)

### Pre-commit Hook

Automatically runs before every commit:

1. **Lint staged files** - ESLint checks only changed files
2. **Format code** - Prettier formats changed files
3. **Block commit** - If errors found, commit is blocked

### How It Works

```
git add file.ts
git commit -m "message"
  ↓
Pre-commit hook runs
  ↓
lint-staged executes:
  - eslint --fix file.ts
  - prettier --write file.ts
  ↓
If errors: Commit blocked ❌
If clean: Commit proceeds ✅
```

### Bypassing Hooks (Emergency Only)

```bash
# Skip pre-commit hook (NOT RECOMMENDED)
git commit --no-verify -m "emergency fix"
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage

Coverage reports are generated in `coverage/` directory:
- `coverage/lcov-report/index.html` - Visual coverage report
- Minimum coverage thresholds can be configured in `jest.config.json`

## 📊 Quality Metrics

### Code Quality Checklist

Before committing, ensure:
- ✅ No ESLint errors
- ✅ Code is formatted (Prettier)
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ No `any` types (except in tests)
- ✅ Functions have return types

### CI/CD Integration

Add to your CI pipeline (e.g., GitHub Actions):

```yaml
name: Quality Gates

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm test
      - run: npx tsc --noEmit
```

## 🛠️ IDE Setup

### VS Code Extensions

Install these extensions:
1. **ESLint** (`dbaeumer.vscode-eslint`)
2. **Prettier** (`esbenp.prettier-vscode`)
3. **TypeScript** (built-in)

### VS Code Settings

Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 🚫 Common Issues & Solutions

### Issue: ESLint errors on `any` type

**Error**: `Unexpected any. Specify a different type.`

**Solution**:
```typescript
// ❌ Bad
function process(data: any) { }

// ✅ Good
function process(data: unknown) { 
  // Type guard
  if (typeof data === 'string') {
    // Now TypeScript knows data is string
  }
}

// ✅ Good (with interface)
interface ProcessData {
  id: string;
  value: number;
}
function process(data: ProcessData) { }
```

### Issue: Prettier conflicts with ESLint

**Solution**: Already configured! `eslint-config-prettier` disables conflicting rules.

### Issue: Pre-commit hook too slow

**Solution**: `lint-staged` only checks changed files, not entire codebase.

### Issue: Want to commit without fixing lints

**Solution**: Fix the lints! But if emergency:
```bash
git commit --no-verify -m "emergency"
```

## 📈 Best Practices

### 1. Fix Lints Immediately

Don't let linting errors accumulate:
```bash
# After making changes
npm run lint:fix
npm run format
```

### 2. Use Type Guards

Instead of `any`, use type guards:
```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

if (isString(data)) {
  // data is now typed as string
  console.log(data.toUpperCase());
}
```

### 3. Explicit Return Types

Always specify return types for public functions:
```typescript
// ✅ Good
function getUser(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// ❌ Avoid (return type inferred)
function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
```

### 4. Handle Promises

Never ignore promises:
```typescript
// ❌ Bad
someAsyncFunction(); // Floating promise

// ✅ Good
await someAsyncFunction();

// ✅ Good (intentional fire-and-forget)
void someAsyncFunction();

// ✅ Good (with error handling)
someAsyncFunction().catch(error => {
  console.error('Failed:', error);
});
```

## 🔧 Customization

### Relaxing Rules (Not Recommended)

Edit `.eslintrc.json`:
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn" // Change from "error" to "warn"
  }
}
```

### Adding Custom Rules

```json
{
  "rules": {
    "no-console": ["error", { "allow": ["warn", "error", "info"] }],
    "max-lines": ["warn", { "max": 300 }]
  }
}
```

## 📚 Resources

- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript ESLint](https://typescript-eslint.io/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/okonet/lint-staged)

## ✅ Verification

To verify quality gates are working:

1. **Create a file with linting errors**:
```typescript
// test.ts
const x: any = 5; // Should error
function test() { return 5 } // Missing return type
```

2. **Try to commit**:
```bash
git add test.ts
git commit -m "test"
```

3. **Expected result**: Commit blocked with ESLint errors

4. **Fix and retry**:
```bash
npm run lint:fix
git add test.ts
git commit -m "test"
```

5. **Expected result**: Commit succeeds ✅
