
import { NextResponse } from 'next/server';
import { postgresPrisma } from '@/common/postgres.service';
import { mongoPrisma } from '@/common/mongo.service';

export const dynamic = 'force-dynamic';

export async function GET() {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            database_relational: 'unknown',
            database_document: 'unknown',
        }
    };

    let status = 200;

    try {
        await postgresPrisma.$queryRaw`SELECT 1`;
        health.services.database_relational = 'up';
    } catch (e) {
        console.error('Postgres Health Check Failed', e);
        health.services.database_relational = 'down';
        status = 503;
        health.status = 'error';
    }

    try {
        await mongoPrisma.$runCommandRaw({ ping: 1 });
        health.services.database_document = 'up';
    } catch (e) {
        console.error('Mongo Health Check Failed', e);
        health.services.database_document = 'down';
        if (status === 200) status = 503; // Only change if not already 503
        health.status = 'error';
    }

    return NextResponse.json(health, { status });
}
