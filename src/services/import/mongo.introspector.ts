import { MongoClient } from 'mongodb';
import { DiagramContent, DiagramNode, DiagramEdge } from '../../types/diagram';
import crypto from 'crypto';

export class MongoIntrospector {
    static async introspect(uri: string): Promise<DiagramContent> {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const db = client.db();
            const collections = await db.listCollections().toArray();

            const nodes: DiagramNode[] = [];
            const edges: DiagramEdge[] = [];
            let currentX = 100, currentY = 100; // Layout cursor

            for (const col of collections) {
                const name = col.name;
                // Sampling 1 document to infer schema
                const sample = await db.collection(name).findOne({});

                const fields = [];
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
