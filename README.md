# Moon Modeler - Backend

Production-ready backend for Moon Modeler - A database schema design and reverse engineering platform.

## 🚀 Features

- ✅ **Type-Safe API** - Built with TypeScript & Next.js 14
- ✅ **Database Support** - MySQL & MongoDB reverse engineering
- ✅ **Security** - SSH Tunneling, RBAC, Input Validation, Rate Limiting
- ✅ **Reliability** - Optimistic Locking, Transactions, Idempotency
- ✅ **Observability** - Winston Logging, Audit Trails
- ✅ **Quality Gates** - ESLint, Prettier, Husky Pre-commit Hooks
- ✅ **Testing** - Unit, Integration & E2E Tests with Jest
- ✅ **API Documentation** - OpenAPI 3.0 Specification

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL (for Prisma)
- Redis (optional, for production rate limiting)

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

## 🏃 Running

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test

# Lint & format
npm run lint
npm run format
```

## 📁 Project Structure

```
src/
├── app/api/v1/          # API routes (versioned)
├── common/              # Shared utilities
│   ├── config/          # Configuration
│   ├── errors/          # Error classes
│   ├── helpers/         # Helper functions
│   ├── jobs/            # Background jobs
│   ├── lib/             # Libraries (logger, SSH)
│   ├── middleware/      # Middleware (rate limit, idempotency)
│   ├── services/        # Common services (audit)
│   └── utils/           # Utilities
├── controllers/         # Request handlers
├── services/            # Business logic
├── jobs/                # Job implementations
└── tests/               # Test files
    ├── factories/       # Test data factories
    ├── integration/     # Integration tests
    └── api/             # E2E tests
```

## 🔐 Environment Variables

See `.env.example` for required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Authentication secret
- `REDIS_URL` - Redis connection (optional)

## 📖 Documentation

- [Production Backend Docs](./PRODUCTION_BACKEND_DOCS.md)
- [API Versioning](./API_VERSIONING.md)
- [Async Jobs](./ASYNC_JOBS.md)
- [Audit Logging](./AUDIT_LOGGING.md)
- [Idempotency & Rate Limiting](./IDEMPOTENCY_RATELIMIT.md)
- [Quality Gates](./QUALITY_GATES.md)
- [Security](./SECURITY.md)
- [Test Factories](./TEST_FACTORIES.md)

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 🔒 Security Features

- **Input Validation** - Zod schemas with size limits
- **SQL Injection Prevention** - Parameterized queries via Prisma
- **XSS Protection** - JSON sanitization
- **Rate Limiting** - Token bucket algorithm
- **SSH Tunneling** - Secure database connections
- **Audit Logging** - Compliance-ready activity tracking
- **RBAC** - Role-based access control

## 🏗️ Architecture

- **Controller-Service-Helper** pattern
- **Transactional operations** for data integrity
- **Optimistic locking** for concurrent updates
- **Smart versioning** with auto-save throttling
- **Async job processing** for long-running tasks

## 📊 API Documentation

Access OpenAPI spec at: `http://localhost:3000/api/v1/docs`

Import into:
- Swagger UI: https://editor.swagger.io/
- Postman: Import → Link
- Code generators: `openapi-generator-cli`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

Pre-commit hooks will automatically:
- Run ESLint
- Format with Prettier
- Run tests

## 📝 License

MIT

## 👤 Author

**Aaditya kumar singh**
- Email: kumaraaditya324@gmail.com
- GitHub: [Aaditya kumar singh](https://github.com/Aaditya kumar singh)

## 🙏 Acknowledgments

Built with:
- Next.js 14
- Prisma ORM
- TypeScript
- Zod
- Winston
- Jest
