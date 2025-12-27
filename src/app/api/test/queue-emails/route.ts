import { NextResponse } from 'next/server';
import { z } from 'zod';

import { enqueueEmailJob, type EmailJobType } from '@/server/queue/email';
import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const ALL_EMAIL_TYPES: EmailJobType[] = [
    'request_received',
    'confirmation',
    'updated',
    'cancelled',
    'reminder_24h',
    'reminder_short',
    'review_request',
    'booking_rejected',
    'restaurant_cancellation',
];

const payloadSchema = z.object({
    bookingId: z.string().uuid().optional(),
    restaurantSlug: z.string().min(3).max(128).optional(),
    emailTypes: z.array(z.enum([
        'request_received',
        'confirmation',
        'updated',
        'cancelled',
        'reminder_24h',
        'reminder_short',
        'review_request',
        'booking_rejected',
        'restaurant_cancellation',
    ])).optional(),
    delaySeconds: z.number().min(0).max(300).default(10),
    intervalSeconds: z.number().min(5).max(60).default(15),
});

async function findRecentBooking(restaurantSlug?: string): Promise<{ id: string; restaurant_id: string } | null> {
    const service = getServiceSupabaseClient();

    let query = service
        .from('bookings')
        .select('id, restaurant_id')
        .order('created_at', { ascending: false })
        .limit(1);

    if (restaurantSlug) {
        // Get restaurant ID by slug first
        const { data: restaurant } = await service
            .from('restaurants')
            .select('id')
            .eq('slug', restaurantSlug)
            .maybeSingle();

        if (restaurant) {
            query = query.eq('restaurant_id', restaurant.id);
        }
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
        return null;
    }

    return data;
}

export async function POST(req: NextRequest) {
    const guard = guardTestEndpoint(req);
    if (guard) return guard;

    const parsed = payloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { bookingId, restaurantSlug, emailTypes, delaySeconds, intervalSeconds } = parsed.data;

    // Find a booking to use
    let targetBookingId = bookingId;
    let restaurantId: string | null = null;

    if (!targetBookingId) {
        const booking = await findRecentBooking(restaurantSlug);
        if (!booking) {
            return NextResponse.json({
                error: 'No booking found. Please provide a bookingId or create a test booking first.',
                hint: 'POST /api/test/bookings to create a test booking'
            }, { status: 404 });
        }
        targetBookingId = booking.id;
        restaurantId = booking.restaurant_id;
    } else {
        // Verify booking exists and get restaurant ID
        const service = getServiceSupabaseClient();
        const { data: booking } = await service
            .from('bookings')
            .select('id, restaurant_id')
            .eq('id', targetBookingId)
            .maybeSingle();

        if (!booking) {
            return NextResponse.json({ error: `Booking ${targetBookingId} not found` }, { status: 404 });
        }
        restaurantId = booking.restaurant_id;
    }

    const typesToQueue = emailTypes ?? ALL_EMAIL_TYPES;
    const queuedJobs: Array<{ type: EmailJobType; delayMs: number; scheduledFor: string }> = [];

    const now = Date.now();
    const baseDelay = delaySeconds * 1000;

    for (let i = 0; i < typesToQueue.length; i++) {
        const type = typesToQueue[i];
        const delayMs = baseDelay + (i * intervalSeconds * 1000);
        const scheduledFor = new Date(now + delayMs).toISOString();

        await enqueueEmailJob(
            {
                bookingId: targetBookingId,
                restaurantId,
                type,
                scheduledFor,
            },
            {
                jobId: `test:${type}:${targetBookingId}:${Date.now()}`,
                delayMs,
            }
        );

        queuedJobs.push({ type, delayMs, scheduledFor });
        console.log(`[test/queue-emails] Queued ${type} for booking ${targetBookingId} with delay ${delayMs}ms`);
    }

    return NextResponse.json({
        success: true,
        bookingId: targetBookingId,
        restaurantId,
        queuedJobs,
        message: `Queued ${queuedJobs.length} email jobs. First job scheduled at ${queuedJobs[0]?.scheduledFor}, last at ${queuedJobs[queuedJobs.length - 1]?.scheduledFor}`,
    });
}

export async function GET(req: NextRequest) {
    const guard = guardTestEndpoint(req);
    if (guard) return guard;

    // Import queue to get status
    const { getEmailQueue } = await import('@/server/queue/email');
    const queue = getEmailQueue();

    // Get job counts
    const [waiting, active, delayed, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getDelayedCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
    ]);

    // Get delayed jobs details
    const delayedJobs = await queue.getDelayed(0, 20);
    const delayedDetails = delayedJobs.map(job => ({
        id: job.id,
        type: job.data.type,
        bookingId: job.data.bookingId,
        delay: job.opts.delay,
        processAt: job.opts.delay ? new Date(job.timestamp + job.opts.delay).toISOString() : null,
    }));

    return NextResponse.json({
        queueStatus: {
            waiting,
            active,
            delayed,
            completed,
            failed,
        },
        delayedJobs: delayedDetails,
        availableEmailTypes: ALL_EMAIL_TYPES,
        usage: {
            method: 'POST',
            body: {
                bookingId: '(optional) UUID of booking to use',
                restaurantSlug: '(optional) slug of restaurant to find a booking from',
                emailTypes: '(optional) array of email types to queue, defaults to all',
                delaySeconds: '(optional) initial delay before first email, default 10',
                intervalSeconds: '(optional) interval between emails, default 15',
            },
        },
    });
}
