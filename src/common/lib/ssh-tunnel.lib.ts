import { Client } from 'ssh2';
import * as net from 'net';

export interface SshConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
}

export interface TunnelConfig {
    sshConfig: SshConfig;
    dstHost: string;
    dstPort: number;
    localPort?: number; // If not provided, random port
}

export class SshTunnel {
    private client: Client;
    private server: net.Server | null = null;
    public localPort: number = 0;

    constructor() {
        this.client = new Client();
    }

    async createTunnel(config: TunnelConfig): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((connection) => {
                this.client.forwardOut(
                    '127.0.0.1',
                    0,
                    config.dstHost,
                    config.dstPort,
                    (err, stream) => {
                        if (err) {
                            connection.end();
                            return;
                        }
                        connection.pipe(stream).pipe(connection);
                    }
                );
            });

            this.client.on('ready', () => {
                // Determine local port
                const port = config.localPort || 0;
                this.server?.listen(port, '127.0.0.1', () => {
                    // @ts-ignore
                    this.localPort = this.server?.address().port;
                    resolve(this.localPort);
                });
            });

            this.client.on('error', (err) => {
                reject(err);
            });

            this.client.connect({
                host: config.sshConfig.host,
                port: config.sshConfig.port,
                username: config.sshConfig.username,
                password: config.sshConfig.password,
                privateKey: config.sshConfig.privateKey
            });
        });
    }

    async close() {
        return new Promise<void>((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.client.end();
                    resolve();
                });
            } else {
                this.client.end();
                resolve();
            }
        });
    }
}
