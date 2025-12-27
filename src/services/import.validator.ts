import { z } from 'zod';

export const ImportMysqlSchema = z.object({
    host: z.string().min(1, 'Host is required'),
    port: z.number().int().min(1).max(65535).default(3306),
    user: z.string().min(1, 'User is required'),
    password: z.string().optional(), // Password might be empty in some dev envs
    database: z.string().min(1, 'Database name is required'),
    // SSH Config Optional
    ssh: z.object({
        host: z.string().min(1, 'SSH Host required'),
        port: z.number().default(22),
        username: z.string().min(1, 'SSH Username required'),
        privateKey: z.string().optional(),
        password: z.string().optional(),
    }).optional(),
});
