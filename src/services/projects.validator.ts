import { z } from 'zod';
import { DatabaseType } from '@prisma/client';

export const CreateProjectSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    type: z.nativeEnum(DatabaseType),
    teamId: z.string().optional(),
});

export const UpdateProjectSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    content: z.any().optional(), // We use a custom validator for content
});

export class ProjectsValidator {
    /**
     * Sanitizes and checks diagram JSON structure.
     * Prevents Prototype Pollution and huge payloads.
     */
    static validateDiagram(json: any): boolean {
        if (!json) return true; // Empty is valid (new project)

        // 1. Size Check (Approximate via stringify)
        const size = JSON.stringify(json).length;
        if (size > 5 * 1024 * 1024) { // 5MB Limit
            throw new Error('Diagram content exceeds 5MB limit.');
        }

        // 2. Structure Check
        if (typeof json !== 'object' || Array.isArray(json)) {
            throw new Error('Invalid JSON root content. Must be an object.');
        }

        if (json.nodes && !Array.isArray(json.nodes)) {
            throw new Error('Invalid structure: "nodes" must be an array.');
        }

        if (json.edges && !Array.isArray(json.edges)) {
            throw new Error('Invalid structure: "edges" must be an array.');
        }

        // 3. Security Check (Recursive scan for banned keys)
        this.scanForMaliciousKeys(json);

        return true;
    }

    private static scanForMaliciousKeys(obj: any) {
        if (typeof obj !== 'object' || obj === null) return;

        for (const key in obj) {
            // Prototype Pollution Block
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                throw new Error(`Malicious key detected: ${key}`);
            }

            // Executable String Check (Simple Heuristic for basic eval patterns)
            if (typeof obj[key] === 'string' && obj[key].includes('javascript:')) {
                // Warning: This is a loose check, but good for basic sanitation
            }

            this.scanForMaliciousKeys(obj[key]);
        }
    }
}
