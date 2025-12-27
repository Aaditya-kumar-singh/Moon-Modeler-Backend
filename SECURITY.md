# Moon Modeler Backend - Security & Secrets Guide

## 🔐 Secrets Management

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your local development values:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/moon_modeler"
   NEXTAUTH_SECRET="generate-a-random-secret-here"
   ```

3. **NEVER commit `.env` to git** - it's already in `.gitignore`

### Production Deployment

**DO NOT use `.env` files in production!**

Instead, use encrypted environment variable injection:

#### Vercel
1. Go to Project Settings → Environment Variables
2. Add variables (encrypted at rest automatically)
3. Vercel injects them at runtime

#### AWS
```bash
# Store secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name moon-modeler/database-url \
  --secret-string "postgresql://..."

# Reference in your application
DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id moon-modeler/database-url \
  --query SecretString --output text)
```

#### Azure
```bash
# Store in Azure Key Vault
az keyvault secret set \
  --vault-name moon-modeler-vault \
  --name database-url \
  --value "postgresql://..."
```

## 🛡️ Log Sanitization

The logger automatically strips sensitive data:

```typescript
import { logSafe } from '@/common/lib/logger';

// This will log password as '***'
logSafe('info', 'User login', {
  username: 'john',
  password: 'secret123'  // Automatically redacted
});

// Output: { username: 'john', password: '***' }
```

**Protected keys** (case-insensitive):
- `password`
- `secret`
- `token`
- `key`

## ✅ Security Checklist

- [ ] `.env` is in `.gitignore`
- [ ] Production secrets use encrypted storage (Vercel/AWS/Azure)
- [ ] No hardcoded secrets in code
- [ ] Logger sanitization is enabled
- [ ] `validateConfig()` is called at startup
- [ ] SSH private keys are stored securely (not in env vars)
- [ ] Database connection strings use SSL in production

## 🚨 What NOT to Do

❌ Hardcode secrets:
```typescript
const dbUrl = "postgresql://user:password@..."; // NEVER!
```

❌ Commit `.env`:
```bash
git add .env  # NEVER!
```

❌ Log sensitive data:
```typescript
console.log(user.password);  // Use logSafe instead!
```

## ✅ What TO Do

✅ Use environment variables:
```typescript
import { config } from '@/common/config';
const dbUrl = config.database.url;
```

✅ Use encrypted secret storage in production

✅ Use `logSafe` for all logging:
```typescript
import { logSafe } from '@/common/lib/logger';
logSafe('info', 'Event', { data });
```
