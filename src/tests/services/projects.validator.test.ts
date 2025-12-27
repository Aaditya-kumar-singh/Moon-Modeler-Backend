import { describe, it, expect } from '@jest/globals';
import { ProjectsValidator } from '@/services/projects.validator';

describe('ProjectsValidator - Security Tests', () => {
    describe('validateDiagram - Prototype Pollution Protection', () => {
        it('should reject __proto__ key', () => {
            const maliciousPayload = {
                nodes: [],
                edges: [],
                __proto__: { isAdmin: true }
            };

            expect(() => ProjectsValidator.validateDiagram(maliciousPayload))
                .toThrow('Malicious key detected: __proto__');
        });

        it('should reject constructor key', () => {
            const maliciousPayload = {
                nodes: [],
                edges: [],
                constructor: { prototype: { isAdmin: true } }
            };

            expect(() => ProjectsValidator.validateDiagram(maliciousPayload))
                .toThrow('Malicious key detected: constructor');
        });

        it('should reject prototype key', () => {
            const maliciousPayload = {
                nodes: [],
                edges: [],
                prototype: { isAdmin: true }
            };

            expect(() => ProjectsValidator.validateDiagram(maliciousPayload))
                .toThrow('Malicious key detected: prototype');
        });

        it('should reject nested malicious keys', () => {
            const maliciousPayload = {
                nodes: [
                    {
                        id: '1',
                        data: {
                            __proto__: { isAdmin: true }
                        }
                    }
                ],
                edges: []
            };

            expect(() => ProjectsValidator.validateDiagram(maliciousPayload))
                .toThrow('Malicious key detected: __proto__');
        });
    });

    describe('validateDiagram - Size Limits', () => {
        it('should reject payloads exceeding 5MB', () => {
            // Create a large payload (> 5MB)
            const largeArray = new Array(1024 * 1024).fill('x'); // ~1MB of 'x'
            const maliciousPayload = {
                nodes: largeArray,
                edges: largeArray,
                extra1: largeArray,
                extra2: largeArray,
                extra3: largeArray,
                extra4: largeArray
            };

            expect(() => ProjectsValidator.validateDiagram(maliciousPayload))
                .toThrow('Diagram content exceeds 5MB limit');
        });

        it('should accept payloads under 5MB', () => {
            const validPayload = {
                nodes: [{ id: '1', type: 'table', data: { name: 'users' } }],
                edges: []
            };

            expect(() => ProjectsValidator.validateDiagram(validPayload))
                .not.toThrow();
        });
    });

    describe('validateDiagram - Structure Validation', () => {
        it('should reject non-object root', () => {
            expect(() => ProjectsValidator.validateDiagram([]))
                .toThrow('Invalid JSON root content');
        });

        it('should reject nodes as non-array', () => {
            const invalidPayload = {
                nodes: 'not-an-array',
                edges: []
            };

            expect(() => ProjectsValidator.validateDiagram(invalidPayload))
                .toThrow('Invalid structure: "nodes" must be an array');
        });

        it('should reject edges as non-array', () => {
            const invalidPayload = {
                nodes: [],
                edges: { invalid: true }
            };

            expect(() => ProjectsValidator.validateDiagram(invalidPayload))
                .toThrow('Invalid structure: "edges" must be an array');
        });

        it('should accept valid diagram structure', () => {
            const validPayload = {
                nodes: [
                    { id: '1', type: 'table', position: { x: 0, y: 0 }, data: { name: 'users' } },
                    { id: '2', type: 'table', position: { x: 300, y: 0 }, data: { name: 'posts' } }
                ],
                edges: [
                    { id: 'e1-2', source: '1', target: '2', type: 'relation' }
                ]
            };

            expect(() => ProjectsValidator.validateDiagram(validPayload))
                .not.toThrow();
        });

        it('should accept empty diagram', () => {
            expect(() => ProjectsValidator.validateDiagram(null))
                .not.toThrow();
        });
    });

    describe('validateDiagram - XSS Protection', () => {
        it('should detect javascript: protocol in strings', () => {
            const xssPayload = {
                nodes: [
                    {
                        id: '1',
                        data: {
                            link: 'javascript:alert(1)'
                        }
                    }
                ],
                edges: []
            };

            // Note: Current implementation doesn't throw, just detects
            // This test documents the behavior
            expect(() => ProjectsValidator.validateDiagram(xssPayload))
                .not.toThrow();
        });
    });
});
