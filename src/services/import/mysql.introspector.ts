import { createConnection } from 'mysql2/promise';
import { DiagramContent, DiagramNode, DiagramEdge, Field } from '../../types/diagram';
import { randomUUID } from 'crypto';

export class MysqlIntrospector {
    static async introspect(connectionString: string): Promise<DiagramContent> {
        let connection;
        try {
            connection = await createConnection(connectionString);
            const config = connection.config as any;
            const database = config.database;

            if (!database) throw new Error('Database not specified in connection string');

            const [columns]: [any[], any] = await connection.execute(`
                SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME, ORDINAL_POSITION
            `, [database]);

            const [fks]: [any[], any] = await connection.execute(`
                SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [database]);

            let currentX = 100, currentY = 100;
            const nodes: DiagramNode[] = [];
            const edges: DiagramEdge[] = [];
            const tableMap = new Map<string, Field[]>();

            for (const col of columns) {
                if (!tableMap.has(col.TABLE_NAME)) tableMap.set(col.TABLE_NAME, []);

                tableMap.get(col.TABLE_NAME)?.push({
                    id: randomUUID(),
                    name: col.COLUMN_NAME,
                    type: col.DATA_TYPE.toUpperCase(),
                    isPrimaryKey: col.COLUMN_KEY === 'PRI',
                    isNullable: col.IS_NULLABLE === 'YES',
                    isUnique: col.COLUMN_KEY === 'UNI',
                    isForeignKey: false,
                });
            }

            tableMap.forEach((fields, tableName) => {
                nodes.push({
                    id: randomUUID(),
                    type: 'mysqlTable',
                    position: { x: currentX, y: currentY },
                    data: { label: tableName, fields }
                });
                currentX += 350;
                if (currentX > 1000) { currentX = 100; currentY += 400; }
            });

            for (const fk of fks) {
                const source = nodes.find(n => n.data.label === fk.TABLE_NAME);
                const target = nodes.find(n => n.data.label === fk.REFERENCED_TABLE_NAME);
                if (source && target) {
                    const field = source.data.fields.find(f => f.name === fk.COLUMN_NAME);
                    if (field) field.isForeignKey = true;
                    edges.push({ id: randomUUID(), source: source.id, target: target.id });
                }
            }

            return { nodes, edges, metadata: { dbType: 'MYSQL' } };
        } finally {
            if (connection) await connection.end();
        }
    }
}
