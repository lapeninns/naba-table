import { NextResponse } from 'next/server';

import { getEmailQueue } from '@/server/queue/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    try {
        const queue = getEmailQueue();

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        // Get some job details
        const waitingJobs = await queue.getWaiting(0, 10);
        const activeJobs = await queue.getActive(0, 10);
        const failedJobs = await queue.getFailed(0, 10);
        const delayedJobs = await queue.getDelayed(0, 10);

        const jobSummary = {
            waiting: waitingJobs.map((j) => ({
                id: j.id,
                name: j.name,
                data: j.data,
                timestamp: j.timestamp,
            })),
            active: activeJobs.map((j) => ({
                id: j.id,
                name: j.name,
                data: j.data,
                timestamp: j.timestamp,
            })),
            failed: failedJobs.map((j) => ({
                id: j.id,
                name: j.name,
                data: j.data,
                failedReason: j.failedReason,
                attemptsMade: j.attemptsMade,
            })),
            delayed: delayedJobs.map((j) => ({
                id: j.id,
                name: j.name,
                data: j.data,
                delay: j.opts?.delay,
                timestamp: j.timestamp,
            })),
        };

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
