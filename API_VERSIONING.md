# API Versioning & Documentation

## 📁 API Structure

```
src/app/api/
├── v1/                    # Version 1 (Current)
│   ├── projects/
│   │   ├── route.ts      # GET /api/v1/projects, POST /api/v1/projects
│   │   └── [id]/
│   │       └── route.ts  # GET /api/v1/projects/:id, PATCH /api/v1/projects/:id
│   ├── import/
│   │   └── mysql/
│   │       └── route.ts  # POST /api/v1/import/mysql
│   ├── auth/
│   │   └── route.ts      # POST /api/v1/auth (placeholder)
│   └── docs/
│       └── route.ts      # GET /api/v1/docs (OpenAPI spec)
└── v2/                    # Future version (when breaking changes needed)
```

## 🔄 Versioning Strategy

### When to Create a New Version

Create a new API version (`v2`, `v3`, etc.) when you need to make **breaking changes**:

**Breaking Changes** (require new version):
- Removing or renaming fields
- Changing field types
- Changing response structure
- Removing endpoints
- Changing authentication method

**Non-Breaking Changes** (can stay in same version):
- Adding new optional fields
- Adding new endpoints
- Adding new query parameters (optional)
- Bug fixes
- Performance improvements

### Version Lifecycle

1. **v1** (Current):
   - Active development
   - All new features (non-breaking)
   - Bug fixes

2. **v2** (When needed):
   - Create new folder: `src/app/api/v2/`
   - Copy relevant routes from v1
   - Make breaking changes
   - Update OpenAPI spec

3. **Deprecation**:
   - Mark v1 as deprecated (add warning header)
   - Give clients 6-12 months to migrate
   - Eventually remove v1

### Example Migration

```typescript
// v1 Response (old)
{
  "data": {
    "id": "123",
    "name": "Project"
  }
}

// v2 Response (breaking change - renamed field)
{
  "data": {
    "id": "123",
    "title": "Project"  // "name" → "title"
  }
}
```

## 📖 OpenAPI Documentation

### Accessing the Spec

**Local Development:**
```
http://localhost:3000/api/v1/docs
```

**Production:**
```
https://api.moonmodeler.com/v1/docs
```

### Using with Swagger UI

1. Go to [Swagger Editor](https://editor.swagger.io/)
2. File → Import URL
3. Enter: `http://localhost:3000/api/v1/docs`
4. View interactive API documentation

### Using with Postman

1. Open Postman
2. Import → Link
3. Enter: `http://localhost:3000/api/v1/docs`
4. Auto-generates collection with all endpoints

### Generating TypeScript Client

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:3000/api/v1/docs \
  -g typescript-fetch \
  -o ./frontend/src/api/generated
```

### Generating Python Client

```bash
openapi-generator-cli generate \
  -i http://localhost:3000/api/v1/docs \
  -g python \
  -o ./clients/python
```

## 🔧 Updating the OpenAPI Spec

When you add/modify endpoints:

1. Edit `backend/openapi.json`
2. Add/update path definitions
3. Add/update schema definitions
4. Test with Swagger UI
5. Commit changes

**Example: Adding a new endpoint**

```json
{
  "paths": {
    "/projects/{id}/versions": {
      "get": {
        "summary": "Get project versions",
        "tags": ["Projects"],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "List of versions",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "data": {
                      "type": "array",
                      "items": { "$ref": "#/components/schemas/Version" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## ✅ Benefits

1. **Type Safety**: Auto-generate typed clients for frontend
2. **Documentation**: Always up-to-date API docs
3. **Testing**: Import into Postman/Insomnia for testing
4. **Contracts**: Clear API contracts for teams
5. **Versioning**: Graceful handling of breaking changes
6. **Discovery**: Easy for new developers to understand API

## 🚀 Best Practices

1. **Always version your APIs** - Even if you think you won't need it
2. **Document as you build** - Update OpenAPI spec with each new endpoint
3. **Use semantic versioning** - v1, v2, v3 (not v1.1, v1.2)
4. **Deprecate gracefully** - Give clients time to migrate
5. **Test with real tools** - Use Swagger UI to validate your spec
6. **Generate clients** - Use code generation for type safety

## 📚 Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Postman](https://www.postman.com/)
