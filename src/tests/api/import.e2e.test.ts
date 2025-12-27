import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ImportController } from '@/controllers/import.controller';
import { NextRequest } from 'next/server';

/**
 * E2E Tests for SSH Tunnel Scenarios
 * 
 * Note: These tests use mocks for SSH connections.
 * In a real production environment, you would:
 * 1. Use a mock SSH server (e.g., ssh2-mock-server)
 * 2. Test actual network failures
 * 3. Test timeout scenarios
 */

// Mock the SSH tunnel
jest.mock('@/common/lib/ssh-tunnel.lib', () => ({
    SshTunnel: jest.fn().mockImplementation(() => ({
        createTunnel: jest.fn(),
        close: jest.fn(),
    }))
}));

// Mock the MySQL connector
jest.mock('@/services/mysql.connector', () => ({
    MysqlConnector: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        extractSchema: jest.fn().mockResolvedValue({
            tables: [],
            warnings: [],
            unsupportedFeatures: []
        }),
        toDiagramJSON: jest.fn().mockReturnValue({ nodes: [], edges: [] })
    }))
}));

describe('SSH Import - E2E Failure Scenarios', () => {
    describe('SSH Connection Failures', () => {
        it('should handle SSH authentication failure gracefully', async () => {
            const { SshTunnel } = await import('@/common/lib/ssh-tunnel.lib');
            const mockTunnel = {
                createTunnel: jest.fn().mockRejectedValue(new Error('SSH Authentication failed')),
                close: jest.fn(),
            };

            (SshTunnel as jest.Mock).mockImplementation(() => mockTunnel);

            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    host: 'db.example.com',
                    port: 3306,
                    user: 'root',
                    password: 'password',
                    database: 'mydb',
                    ssh: {
                        host: 'ssh.example.com',
                        port: 22,
                        username: 'sshuser',
                        password: 'wrongpassword'
                    }
                })
            } as unknown as NextRequest;

            const response = await ImportController.importMysql(mockRequest);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.error).toBeDefined();
            expect(body.error.message).toContain('SSH Authentication failed');
        });

        it('should handle SSH timeout', async () => {
            const { SshTunnel } = await import('@/common/lib/ssh-tunnel.lib');
            const mockTunnel = {
                createTunnel: jest.fn().mockRejectedValue(new Error('Connection timeout')),
                close: jest.fn(),
            };

            (SshTunnel as jest.Mock).mockImplementation(() => mockTunnel);

            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    host: 'db.example.com',
                    port: 3306,
                    user: 'root',
                    password: 'password',
                    database: 'mydb',
                    ssh: {
                        host: 'unreachable.example.com',
                        port: 22,
                        username: 'sshuser',
                        password: 'password'
                    }
                })
            } as unknown as NextRequest;

            const response = await ImportController.importMysql(mockRequest);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.error.message).toContain('timeout');
        });

        it('should always close SSH tunnel even on error', async () => {
            const { SshTunnel } = await import('@/common/lib/ssh-tunnel.lib');
            const { MysqlConnector } = await import('@/services/mysql.connector');

            const mockTunnel = {
                createTunnel: jest.fn().mockResolvedValue(13306),
                close: jest.fn(),
            };

            const mockConnector = {
                connect: jest.fn().mockRejectedValue(new Error('Database connection failed')),
                disconnect: jest.fn(),
                extractSchema: jest.fn(),
                toDiagramJSON: jest.fn()
            };

            (SshTunnel as jest.Mock).mockImplementation(() => mockTunnel);
            (MysqlConnector as jest.Mock).mockImplementation(() => mockConnector);

            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    host: 'db.example.com',
                    port: 3306,
                    user: 'root',
                    password: 'password',
                    database: 'mydb',
                    ssh: {
                        host: 'ssh.example.com',
                        port: 22,
                        username: 'sshuser',
                        password: 'password'
                    }
                })
            } as unknown as NextRequest;

            await ImportController.importMysql(mockRequest);

            // Verify tunnel was closed even though DB connection failed
            expect(mockTunnel.close).toHaveBeenCalled();
            expect(mockConnector.disconnect).toHaveBeenCalled();
        });
    });

    describe('Database Connection Failures (via SSH)', () => {
        it('should handle database authentication failure through tunnel', async () => {
            const { SshTunnel } = await import('@/common/lib/ssh-tunnel.lib');
            const { MysqlConnector } = await import('@/services/mysql.connector');

            const mockTunnel = {
                createTunnel: jest.fn().mockResolvedValue(13306),
                close: jest.fn(),
            };

            const mockConnector = {
                connect: jest.fn().mockRejectedValue(new Error('Access denied for user')),
                disconnect: jest.fn(),
                extractSchema: jest.fn(),
                toDiagramJSON: jest.fn()
            };

            (SshTunnel as jest.Mock).mockImplementation(() => mockTunnel);
            (MysqlConnector as jest.Mock).mockImplementation(() => mockConnector);

            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    host: 'db.example.com',
                    port: 3306,
                    user: 'root',
                    password: 'wrongpassword',
                    database: 'mydb',
                    ssh: {
                        host: 'ssh.example.com',
                        port: 22,
                        username: 'sshuser',
                        password: 'password'
                    }
                })
            } as unknown as NextRequest;

            const response = await ImportController.importMysql(mockRequest);
            const body = await response.json();

            expect(response.status).toBe(500);
            expect(body.error.message).toContain('Access denied');
        });
    });

    describe('Direct Connection (No SSH)', () => {
        it('should work without SSH tunnel', async () => {
            const { MysqlConnector } = await import('@/services/mysql.connector');

            const mockConnector = {
                connect: jest.fn().mockResolvedValue(true),
                disconnect: jest.fn(),
                extractSchema: jest.fn().mockResolvedValue({
                    tables: [{ name: 'users', columns: [], foreignKeys: [] }],
                    warnings: [],
                    unsupportedFeatures: []
                }),
                toDiagramJSON: jest.fn().mockReturnValue({
                    nodes: [{ id: 'users', type: 'tableNode' }],
                    edges: []
                })
            };

            (MysqlConnector as jest.Mock).mockImplementation(() => mockConnector);

            const mockRequest = {
                json: jest.fn().mockResolvedValue({
                    host: 'localhost',
                    port: 3306,
                    user: 'root',
                    password: 'password',
                    database: 'mydb'
                    // No SSH config
                })
            } as unknown as NextRequest;

            const response = await ImportController.importMysql(mockRequest);
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.data.schema).toBeDefined();
            expect(body.data.schema.nodes).toHaveLength(1);
        });
    });
});
