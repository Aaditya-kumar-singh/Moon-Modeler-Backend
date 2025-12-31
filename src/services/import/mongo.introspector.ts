import { MongoClient } from 'mongodb';
import { DiagramContent, DiagramNode, DiagramEdge } from '../../types/diagram';
import crypto from 'crypto';

export class MongoIntrospector {
    static async introspect(uri: string): Promise<DiagramContent> {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const db = client.db();

            let collections;
            try {
                // Try to get full collection info (including validators)
                collections = await db.listCollections().toArray();
            } catch (e: any) {
                // Fallback: If unauthorized to read system.views (validators), try name-only
                if (e.code === 13 || e.codeName === 'Unauthorized') {
                    console.warn('Unauthorized to list full collection info, falling back to names only.');
                    collections = await db.listCollections({}, { nameOnly: true }).toArray();
                } else {
                    throw e;
                }
            }

            const nodes: DiagramNode[] = [];
            const edges: DiagramEdge[] = [];
            let currentX = 100, currentY = 100; // Layout cursor

            for (const col of collections) {
                const name = col.name;
                const fields: any[] = [];

                // 1. Try JSON Schema Validator
                // @ts-ignore
                const schema = col.options?.validator?.$jsonSchema;

                if (schema && schema.properties) {
                    // Extract fields from Schema
                    fields.push({
                        id: crypto.randomUUID(),
                        name: '_id',
                        type: 'ObjectId',
                        isPrimaryKey: true,
                        isNullable: false
                    });

                    for (const [key, prop] of Object.entries(schema.properties)) {
                        if (key === '_id') continue;
                        const p = prop as any;
                        fields.push({
                            id: crypto.randomUUID(),
                            name: key,
                            type: this.mapType(p.bsonType || p.type || 'string'),
                            isNullable: !schema.required?.includes(key),
                            isPrimaryKey: false
                        });
                    }
                } else {
                    // 2. Fallback: Sampling 1 document
                    let sample;
                    try {
                        sample = await db.collection(name).findOne({});
                    } catch (err) {
                        console.warn(`Failed to sample document from ${name}`, err);
                        // Continue effectively with sample = undefined, so we only get _id
                    }

                    // Always add _id
                    fields.push({
                        id: crypto.randomUUID(),
                        name: '_id',
                        type: 'ObjectId',
                        isPrimaryKey: true,
                        isNullable: false
                    });

                    if (sample) {
                        for (const [key, value] of Object.entries(sample)) {
                            if (key === '_id') continue;

                            fields.push({
                                id: crypto.randomUUID(),
                                name: key,
                                type: this.mapType(value),
                                isNullable: true,
                                isPrimaryKey: false
                            });
                        }
                    }
                }

                const node: DiagramNode = {
                    id: crypto.randomUUID(),
                    type: 'mongoCollection',
                    position: { x: currentX, y: currentY },
                    data: { label: name, fields }
                };
                nodes.push(node);

                // Simple Grid Layout
                currentX += 350;
                if (currentX > 1000) {
                    currentX = 100;
                    currentY += 400;
                }
            }

            // Naive Relationship Inference based on field naming conventions
            // e.g. userId -> users._id
            for (const source of nodes) {
                for (const field of source.data.fields) {
                    if (field.name.endsWith('Id') && field.name !== '_id') {
                        // infer target name: userId -> users, productId -> products
                        const base = field.name.replace('Id', '').toLowerCase();
                        // Try plural forms
                        const target = nodes.find(n =>
                            n.data.label.toLowerCase() === base ||
                            n.data.label.toLowerCase() === base + 's'
                        );

                        if (target) {
                            edges.push({
                                id: crypto.randomUUID(),
                                source: source.id,
                                target: target.id
                            });
                        }
                    }
                }
            }

            return {
                nodes,
                edges,
                metadata: { dbType: 'MONGODB' }
            };
        } finally {
            await client.close();
        }
    }

    private static mapType(value: any): string {
        if (value === null) return 'String';
        if (Array.isArray(value)) return 'Array';
        // Detect BSON ObjectId shim or checks
        if (typeof value === 'object' && (value.constructor.name === 'ObjectId' || value._bsontype === 'ObjectId')) return 'ObjectId';
        if (value instanceof Date) return 'Date';
        const t = typeof value;
        return t.charAt(0).toUpperCase() + t.slice(1); // 'number' -> 'Number'
    }
}
