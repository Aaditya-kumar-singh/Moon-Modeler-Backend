import { BaseJob } from '@/common/jobs/base.job';
import { MysqlConnector } from '@/services/mysql.connector';
import { SshTunnel } from '@/common/lib/ssh-tunnel.lib';
import { logSafe } from '@/common/lib/logger';

/**
 * MySQL Import Job Input
 */
export interface MysqlImportInput {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssh?: {
        host: string;
        port: number;
        username: string;
        password?: string;
        privateKey?: string;
    };
}

/**
 * MySQL Import Job Output
 */
export interface MysqlImportOutput {
    schema: {
        nodes: any[];
        edges: any[];
    };
    warnings: string[];
    unsupportedFeatures: string[];
    tableCount: number;
}

/**
 * MySQL Import Job
 * 
 * Handles reverse engineering of MySQL databases.
 * Can take > 500ms for large databases, so should be run in background.
 * 
 * Usage:
 * ```typescript
 * const job = new MysqlImportJob();
 * const result = await JobExecutor.executeBackground(job, config);
 * ```
 */
export class MysqlImportJob extends BaseJob<MysqlImportInput, MysqlImportOutput> {
    constructor() {
        super('mysql-import');
    }

    protected async run(input: MysqlImportInput): Promise<MysqlImportOutput> {
        const connector = new MysqlConnector();
        const tunnel = new SshTunnel();
        let tunnelActive = false;

        try {
            let dbHost = input.host;
            let dbPort = input.port;

            // 1. Establish SSH Tunnel if configured
            if (input.ssh) {
                const localPort = await tunnel.createTunnel({
                    sshConfig: {
                        host: input.ssh.host,
                        port: input.ssh.port,
                        username: input.ssh.username,
                        password: input.ssh.password,
                        privateKey: input.ssh.privateKey
                    },
                    dstHost: input.host,
                    dstPort: input.port
                });

                tunnelActive = true;
                logSafe('info', 'SSH_CONNECTION_OPEN', {
                    sshHost: input.ssh.host,
                    localPort,
                    dstHost: input.host
                });

                dbHost = '127.0.0.1';
                dbPort = localPort;
            }

            // 2. Connect to Database
            await connector.connect({
                host: dbHost,
                port: dbPort,
                user: input.user,
                password: input.password,
                database: input.database
            });

            // 3. Extract Schema
            const rawSchema = await connector.extractSchema(input.database);
            const diagram = connector.toDiagramJSON(rawSchema);

            return {
                schema: diagram,
                warnings: rawSchema.warnings || [],
                unsupportedFeatures: rawSchema.unsupportedFeatures || [],
                tableCount: rawSchema.tables.length,
            };

        } finally {
            // 4. Cleanup
            await connector.disconnect();
            await tunnel.close();

            if (tunnelActive) {
                logSafe('info', 'SSH_CONNECTION_CLOSE', {});
            }
        }
    }
}
