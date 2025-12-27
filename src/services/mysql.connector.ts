import mysql from 'mysql2/promise';

export interface SqlColumn {
    Field: string;
    Type: string;
    Null: string;
    Key: string;
    Default: string | null;
    Extra: string;
}

export interface SqlTable {
    name: string;
    columns: SqlColumn[];
    foreignKeys: any[]; // To be implemented logic for extracting FKs
}

export interface ImportResult {
    tables: SqlTable[];
    warnings: string[];
    unsupportedFeatures: string[];
}

export class MysqlConnector {
    private connection: mysql.Connection | null = null;

    async connect(config: mysql.ConnectionOptions) {
        try {
            this.connection = await mysql.createConnection(config);
            return true;
        } catch (error: any) {
            throw new Error(`MySQL Connection Failed: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }

    async extractSchema(databaseName: string): Promise<ImportResult> {
        if (!this.connection) throw new Error('Not connected');

        const result: ImportResult = {
            tables: [],
            warnings: [],
            unsupportedFeatures: [],
        };

        try {
            // 1. Get Tables
            const [tables]: any[] = await this.connection.query(`SHOW TABLES FROM \`${databaseName}\``);

            for (const row of tables) {
                const tableName = Object.values(row)[0] as string;

                // 2. Get Columns
                const [columns]: any[] = await this.connection.query(`DESCRIBE \`${databaseName}\`.\`${tableName}\``);

                // 3. (Optional) Get Foreign Keys - Basic query for typical information_schema usage could go here
                // For MVP, we stick to columns.

                result.tables.push({
                    name: tableName,
                    columns: columns as SqlColumn[],
                    foreignKeys: [],
                });
            }

        } catch (error: any) {
            result.warnings.push(`Extraction partial failure: ${error.message}`);
        }

        return result;
    }

    /**
     * Converts the extracted SQL schema into Moon Modeler JSON format (Nodes & Edges)
     * This allows the frontend to immediately render the diagram.
     */
    toDiagramJSON(importResult: ImportResult) {
        const nodes: any[] = [];
        const edges: any[] = [];
        let x = 100;
        let y = 100;

        importResult.tables.forEach((table, index) => {
            // Create a Node for representing the Table
            nodes.push({
                id: table.name,
                type: 'tableNode', // Frontend will have a component for this
                position: { x, y },
                data: {
                    label: table.name,
                    columns: table.columns.map(col => ({
                        name: col.Field,
                        type: col.Type,
                        isPrimaryKey: col.Key === 'PRI',
                        isForeignKey: col.Key === 'MUL', // simplified assumption
                    }))
                }
            });

            // Simple layouting: grid-like
            x += 300;
            if (x > 1000) {
                x = 100;
                y += 300;
            }
        });

        return { nodes, edges };
    }
}
