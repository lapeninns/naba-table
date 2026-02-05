import { NextResponse } from 'next/server';

import { getEmailQueue } from '@/server/queue/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    // This endpoint exposes operational queue metadata and must not be public.
    // We reuse CRON_SECRET auth (same mechanism as cron routes) for simplicity.
    const authHeader = request.headers.get('authorization');
    const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

    if (!CRON_SECRET) {
        return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    }

    if (!hasValidBearerToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const queue = getEmailQueue();

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        const url = new URL(request.url);
        const includeJobs = ['1', 'true', 'yes'].includes((url.searchParams.get('includeJobs') ?? '').toLowerCase());

        const jobSummary = includeJobs
            ? {
                waiting: (await queue.getWaiting(0, 10)).map((j) => ({
                    id: j.id,
                    name: j.name,
                    data: j.data,
                    timestamp: j.timestamp,
                })),
                active: (await queue.getActive(0, 10)).map((j) => ({
                    id: j.id,
                    name: j.name,
                    data: j.data,
                    timestamp: j.timestamp,
                })),
                failed: (await queue.getFailed(0, 10)).map((j) => ({
                    id: j.id,
                    name: j.name,
                    data: j.data,
                    failedReason: j.failedReason,
                    attemptsMade: j.attemptsMade,
                })),
                delayed: (await queue.getDelayed(0, 10)).map((j) => ({
                    id: j.id,
                    name: j.name,
                    data: j.data,
                    delay: j.opts?.delay,
                    timestamp: j.timestamp,
                })),
            }
            : null;

        return NextResponse.json({
            status: 'ok',
            queue: {
                counts: {
                    waiting,
                    active,
                    completed,
                    failed,
                    delayed,
                    total: waiting + active + delayed,
                },
                jobs: jobSummary,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[admin][queue-status] error:', error);
        return NextResponse.json(
            {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? error.stack : undefined,
            },
            { status: 500 }
        );
    }
}
