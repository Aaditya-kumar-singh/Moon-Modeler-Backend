import { NextResponse } from 'next/server';
import openApiSpec from '@/../openapi.json';

/**
 * OpenAPI Specification Endpoint
 * 
 * Serves the OpenAPI 3.0 specification for the API.
 * Can be used with Swagger UI, Postman, or code generators.
 * 
 * Usage:
 * - Swagger UI: https://editor.swagger.io/?url=http://localhost:3000/api/v1/docs
 * - Postman: Import → Link → http://localhost:3000/api/v1/docs
 * - Code Gen: openapi-generator-cli generate -i http://localhost:3000/api/v1/docs
 */
export async function GET() {
    return NextResponse.json(openApiSpec, {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Allow Swagger Editor access
        }
    });
}
