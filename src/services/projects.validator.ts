import { z } from 'zod';
import { DatabaseType } from '@prisma/client';

// --- Primitive Validators ---
// --- Primitive Validators ---
const FieldId = z.string(); // Relaxed from UUID to support legacy/simple IDs
const SafeString = z.string(); // Relaxed

// --- MySQL Schemas ---
const MysqlFieldSchema = z.object({
    id: FieldId,
    name: SafeString,
    type: z.string(), // Relaxed from Enum to support all DB types
    isPrimaryKey: z.boolean().optional(),
    isForeignKey: z.boolean().optional(),
    isNullable: z.boolean().optional(),
    isUnique: z.boolean().optional(),
    isIndex: z.boolean().optional(),
    defaultValue: z.string().optional()
});

const MysqlNodeSchema = z.object({
    id: z.string(), // Relaxed
    type: z.literal('mysqlTable'),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    data: z.object({
        label: SafeString,
        fields: z.array(MysqlFieldSchema).max(200),
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    selected: z.boolean().optional(),
    positionAbsolute: z.object({ x: z.number(), y: z.number() }).optional(),
    dragging: z.boolean().optional(),
});

// --- MongoDB Schemas ---
const MongoFieldSchema = z.object({
    id: FieldId,
    name: SafeString,
    type: z.string(), // Relaxed
    isNullable: z.boolean().optional(), // Maps to Optional/Required concept
    isPrimaryKey: z.boolean().optional(), // Added for flexibility
    // No PK/FK flags
});

const MongoNodeSchema = z.object({
    id: z.string(), // Relaxed
    type: z.literal('mongoCollection'),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    data: z.object({
        label: SafeString,
        fields: z.array(MongoFieldSchema).max(200),
    }),
    width: z.number().optional(),
    height: z.number().optional(),
    selected: z.boolean().optional(),
    positionAbsolute: z.object({ x: z.number(), y: z.number() }).optional(),
    dragging: z.boolean().optional(),
});

// --- Edge Schema ---
const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().nullish(), // allows null or undefined
    targetHandle: z.string().nullish(),
    type: z.string().nullish(),
    animated: z.boolean().nullish(),
    selected: z.boolean().nullish(),
});

// --- Full Diagram Schema ---
export const DiagramSchema = z.object({
    // version: z.number(), // Sometimes passed as '1' or undefined in initial saves
    metadata: z.object({
        version: z.number().optional(),
        dbType: z.enum(['MYSQL', 'MONGODB']),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
    }).optional(),

    // Nodes must match the DB Type
    nodes: z.array(z.discriminatedUnion('type', [
        MysqlNodeSchema,
        MongoNodeSchema,
    ])),
    edges: z.array(EdgeSchema),
}).refine((diagram) => {
    if (!diagram.metadata || !diagram.metadata.dbType) return true; // Skip if metadata missing (legacy)

    const expectedType = diagram.metadata.dbType === 'MYSQL' ? 'mysqlTable' : 'mongoCollection';
    return diagram.nodes.every(n => n.type === expectedType);
}, {
    message: 'All nodes must match the project database type (mysqlTable for MySQL, mongoCollection for MongoDB)',
    path: ['nodes']
});


export const CreateProjectSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    type: z.nativeEnum(DatabaseType),
    teamId: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    content: z.any().optional(),
    version: z.number().optional(),
});

export const ImportSchema = z.object({
    type: z.enum(['MYSQL', 'MONGODB']),
    connectionString: z.string().min(1, 'Connection string is required'),
});

export const ExportSchema = z.object({
    content: z.any() // We validate this strictly with ProjectsValidator.validateDiagram at runtime for better errors
});

export const VersionRestoreSchema = z.object({
    versionId: z.string().optional(), // If passed in body, though typically path param
});

export class ProjectsValidator {
    static validateDiagram(json: any) {
        if (!json) return true;

        // 1. Size Safety
        const size = JSON.stringify(json).length;
        if (size > 5 * 1024 * 1024) {
            throw new Error('Diagram content exceeds 5MB limit.');
        }

        // 2. Strict Zod Validation
        return DiagramSchema.parse(json);
    }
}
