import { NextResponse } from 'next/server';
import { z } from 'zod';

import { enqueueEmailJob, getEmailQueue, type EmailJobType } from '@/server/queue/email';
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

// Map email types to required booking statuses
const EMAIL_TYPE_STATUS_MAP: Record<EmailJobType, string> = {
    'request_received': 'pending',
    'confirmation': 'confirmed',
    'updated': 'confirmed', // Works with any, but confirmed is common
    'cancelled': 'cancelled',
    'reminder_24h': 'confirmed',
    'reminder_short': 'confirmed',
    'review_request': 'completed',
    'booking_rejected': 'cancelled', // Rejection implies cancellation
    'restaurant_cancellation': 'cancelled',
};

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
    intervalSeconds: z.number().min(1).max(60).default(13),
    clearExisting: z.boolean().default(false),
    createTestBookings: z.boolean().default(false),
});

async function clearAllJobs(): Promise<{ cleared: number }> {
    const queue = getEmailQueue();

    // Get all jobs in different states
    const [delayed, waiting] = await Promise.all([
        queue.getDelayed(),
        queue.getWaiting(),
    ]);

    let cleared = 0;

    // Remove delayed jobs
    for (const job of delayed) {
        try {
            await job.remove();
            cleared++;
        } catch (e) {
            console.warn(`Failed to remove delayed job ${job.id}:`, e);
        }
    }

    // Remove waiting jobs
    for (const job of waiting) {
        try {
            await job.remove();
            cleared++;
        } catch (e) {
            console.warn(`Failed to remove waiting job ${job.id}:`, e);
        }
    }

    console.log(`[test/queue-emails] Cleared ${cleared} jobs from queue`);
    return { cleared };
}

type BookingsByStatus = {
    pending: string | null;
    confirmed: string | null;
    completed: string | null;
    cancelled: string | null;
};

async function findOrCreateBookingsByStatus(restaurantSlug?: string): Promise<{ bookings: BookingsByStatus; restaurantId: string }> {
    const service = getServiceSupabaseClient();

    // Find restaurant
    let restaurantId: string | null = null;
    if (restaurantSlug) {
        const { data: restaurant } = await service
            .from('restaurants')
            .select('id')
            .eq('slug', restaurantSlug)
            .maybeSingle();
        restaurantId = restaurant?.id ?? null;
    }

    // If no restaurant specified, get one with existing bookings
    if (!restaurantId) {
        const { data: anyBooking } = await service
            .from('bookings')
            .select('restaurant_id')
            .limit(1)
            .maybeSingle();
        restaurantId = anyBooking?.restaurant_id ?? null;
    }

    if (!restaurantId) {
        throw new Error('No restaurant found');
    }

    const bookings: BookingsByStatus = {
        pending: null,
        confirmed: null,
        completed: null,
        cancelled: null,
    };

    // Find existing bookings for each status
    const statuses = ['pending', 'confirmed', 'completed', 'cancelled'] as const;

    for (const status of statuses) {
        const { data } = await service
            .from('bookings')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('status', status)
            .limit(1)
            .maybeSingle();

        if (data) {
            bookings[status] = data.id;
        }
    }

    // If we're missing any status, we need to create or update bookings
    // For this test, we'll update existing bookings to have the right status
    const missingStatuses = statuses.filter(s => !bookings[s]);

    if (missingStatuses.length > 0) {
        // Get bookings we can update
        const { data: availableBookings } = await service
            .from('bookings')
            .select('id, status')
            .eq('restaurant_id', restaurantId)
            .limit(missingStatuses.length);

        if (availableBookings) {
            for (let i = 0; i < Math.min(missingStatuses.length, availableBookings.length); i++) {
                const booking = availableBookings[i];
                const targetStatus = missingStatuses[i];

                // Update booking status
                await service
                    .from('bookings')
                    .update({ status: targetStatus })
                    .eq('id', booking.id);

                bookings[targetStatus] = booking.id;
                console.log(`[test/queue-emails] Updated booking ${booking.id} to status ${targetStatus}`);
            }
        }
    }

    return { bookings, restaurantId };
}

async function findRecentBooking(restaurantSlug?: string): Promise<{ id: string; restaurant_id: string } | null> {
    const service = getServiceSupabaseClient();

    let query = service
        .from('bookings')
        .select('id, restaurant_id')
        .order('created_at', { ascending: false })
        .limit(1);

    if (restaurantSlug) {
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

    const { bookingId, restaurantSlug, emailTypes, delaySeconds, intervalSeconds, clearExisting, createTestBookings } = parsed.data;

    // Clear existing jobs if requested
    let clearedCount = 0;
    if (clearExisting) {
        const result = await clearAllJobs();
        clearedCount = result.cleared;
    }

    const typesToQueue = emailTypes ?? ALL_EMAIL_TYPES;
    const queuedJobs: Array<{ type: EmailJobType; bookingId: string; status: string; delayMs: number; scheduledFor: string }> = [];

    const now = Date.now();
    const baseDelay = delaySeconds * 1000;

    if (createTestBookings) {
        // Create/find bookings with proper statuses for each email type
        try {
            const { bookings, restaurantId } = await findOrCreateBookingsByStatus(restaurantSlug);

            for (let i = 0; i < typesToQueue.length; i++) {
                const type = typesToQueue[i];
                const requiredStatus = EMAIL_TYPE_STATUS_MAP[type];

                // Map status to our booking categories
                let bookingStatus: keyof BookingsByStatus;
                if (requiredStatus === 'pending' || requiredStatus === 'pending_allocation') {
                    bookingStatus = 'pending';
                } else if (requiredStatus === 'confirmed') {
                    bookingStatus = 'confirmed';
                } else if (requiredStatus === 'completed') {
                    bookingStatus = 'completed';
                } else {
                    bookingStatus = 'cancelled';
                }

                const targetBookingId = bookings[bookingStatus];

                if (!targetBookingId) {
                    console.warn(`[test/queue-emails] No booking with status ${bookingStatus} for email type ${type}`);
                    continue;
                }

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

                queuedJobs.push({ type, bookingId: targetBookingId, status: bookingStatus, delayMs, scheduledFor });
                console.log(`[test/queue-emails] Queued ${type} for booking ${targetBookingId} (${bookingStatus}) with delay ${delayMs}ms`);
            }

            return NextResponse.json({
                success: true,
                clearedJobs: clearedCount,
                bookingsUsed: bookings,
                restaurantId,
                queuedJobs,
                message: `Cleared ${clearedCount} jobs, queued ${queuedJobs.length} email jobs with proper booking statuses`,
            });
        } catch (error) {
            return NextResponse.json({
                error: 'Failed to create test bookings',
                details: error instanceof Error ? error.message : String(error)
            }, { status: 500 });
        }
    }

    // Simple mode - use single booking
    let targetBookingId = bookingId;
    let restaurantId: string | null = null;

    if (!targetBookingId) {
        const booking = await findRecentBooking(restaurantSlug);
        if (!booking) {
            return NextResponse.json({
                error: 'No booking found. Please provide a bookingId or create a test booking first.',
                hint: 'POST /api/test/bookings to create a test booking, or use createTestBookings: true'
            }, { status: 404 });
        }
        targetBookingId = booking.id;
        restaurantId = booking.restaurant_id;
    } else {
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

        queuedJobs.push({ type, bookingId: targetBookingId, status: 'unknown', delayMs, scheduledFor });
        console.log(`[test/queue-emails] Queued ${type} for booking ${targetBookingId} with delay ${delayMs}ms`);
    }

    return NextResponse.json({
        success: true,
        clearedJobs: clearedCount,
        bookingId: targetBookingId,
        restaurantId,
        queuedJobs,
        message: `Cleared ${clearedCount} jobs, queued ${queuedJobs.length} email jobs. First at ${queuedJobs[0]?.scheduledFor}, last at ${queuedJobs[queuedJobs.length - 1]?.scheduledFor}`,
    });
}

export async function GET(req: NextRequest) {
    const guard = guardTestEndpoint(req);
    if (guard) return guard;

    const queue = getEmailQueue();

    const [waiting, active, delayed, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getDelayedCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
    ]);

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
        emailTypeStatusRequirements: EMAIL_TYPE_STATUS_MAP,
        usage: {
            method: 'POST',
            body: {
                bookingId: '(optional) UUID of booking to use',
                restaurantSlug: '(optional) slug of restaurant to find a booking from',
                emailTypes: '(optional) array of email types to queue, defaults to all',
                delaySeconds: '(optional) initial delay before first email, default 10',
                intervalSeconds: '(optional) interval between emails, default 13',
                clearExisting: '(optional) clear all existing jobs first, default false',
                createTestBookings: '(optional) create/find bookings with correct statuses for each email type, default false',
            },
        },
    });
}

export async function DELETE(req: NextRequest) {
    const guard = guardTestEndpoint(req);
    if (guard) return guard;

    const result = await clearAllJobs();

    return NextResponse.json({
        success: true,
        message: `Cleared ${result.cleared} jobs from queue`,
        cleared: result.cleared,
    });
}
