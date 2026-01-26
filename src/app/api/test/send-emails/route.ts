import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
    sendBookingCancellationEmail,
    sendBookingConfirmationEmail,
    sendBookingRejectedEmail,
    sendBookingReminderEmail,
    sendBookingReviewRequestEmail,
    sendBookingUpdateEmail,
    sendRestaurantCancellationEmail,
} from '@/server/emails/bookings';
import { EMAIL_JOB_TYPES, type EmailJobType } from '@/server/queue/email';
import { guardTestEndpoint } from '@/server/security/test-endpoints';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// Default test email - ALL test emails go here to avoid emailing real customers
const DEFAULT_TEST_EMAIL = 'amanshresthaaaaa@gmail.com';

const ALL_EMAIL_TYPES: EmailJobType[] = [...EMAIL_JOB_TYPES];

// Map email types to required booking statuses
const EMAIL_TYPE_STATUS_MAP: Record<EmailJobType, string> = {
    'request_received': 'pending',
    'confirmation': 'confirmed',
    'updated': 'confirmed',
    'cancelled': 'cancelled',
    'reminder_24h': 'confirmed',
    'reminder_short': 'confirmed',
    'review_request': 'completed',
    'booking_rejected': 'cancelled',
    'restaurant_cancellation': 'cancelled',
};

const payloadSchema = z.object({
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
    delayMs: z.number().min(0).max(10000).default(500),
    // Override email - ALL emails go to this address (prevents emailing real customers)
    testEmail: z.string().email().default(DEFAULT_TEST_EMAIL),
});

type BookingsByStatus = {
    pending: BookingRecord | null;
    confirmed: BookingRecord | null;
    completed: BookingRecord | null;
    cancelled: BookingRecord | null;
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
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('status', status)
            .limit(1)
            .maybeSingle();

        if (data) {
            bookings[status] = data as BookingRecord;
        }
    }

    // If we're missing any status, update existing bookings
    const missingStatuses = statuses.filter(s => !bookings[s]);

    if (missingStatuses.length > 0) {
        const { data: availableBookings } = await service
            .from('bookings')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .limit(missingStatuses.length);

        if (availableBookings) {
            for (let i = 0; i < Math.min(missingStatuses.length, availableBookings.length); i++) {
                const booking = availableBookings[i];
                const targetStatus = missingStatuses[i];

                await service
                    .from('bookings')
                    .update({ status: targetStatus })
                    .eq('id', booking.id);

                booking.status = targetStatus;
                bookings[targetStatus] = booking as BookingRecord;
                console.log(`[test/send-emails] Updated booking ${booking.id} to status ${targetStatus}`);
            }
        }
    }

    return { bookings, restaurantId };
}

async function dispatchEmail(type: EmailJobType, booking: BookingRecord): Promise<void> {
    switch (type) {
        case 'request_received':
        case 'confirmation':
            await sendBookingConfirmationEmail(booking);
            return;
        case 'reminder_24h':
            await sendBookingReminderEmail(booking, { variant: 'standard' });
            return;
        case 'reminder_short':
            await sendBookingReminderEmail(booking, { variant: 'short' });
            return;
        case 'review_request':
            await sendBookingReviewRequestEmail(booking);
            return;
        case 'updated':
            await sendBookingUpdateEmail(booking);
            return;
        case 'cancelled':
            await sendBookingCancellationEmail(booking);
            return;
        case 'restaurant_cancellation':
            await sendRestaurantCancellationEmail(booking);
            return;
        case 'booking_rejected':
            await sendBookingRejectedEmail(booking);
            return;
        default:
            console.warn(`[test/send-emails] Unknown email type: ${type}`);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
    const guard = guardTestEndpoint(req);
    if (guard) return guard;

    const parsed = payloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { restaurantSlug, emailTypes, delayMs, testEmail } = parsed.data;
    const typesToSend = emailTypes ?? ALL_EMAIL_TYPES;

    console.log(`[test/send-emails] ⚠️ All emails will be sent to: ${testEmail}`);

    const results: Array<{ type: EmailJobType; status: string; success: boolean; error?: string }> = [];

    try {
        const { bookings, restaurantId } = await findOrCreateBookingsByStatus(restaurantSlug);

        for (const type of typesToSend) {
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

            const booking = bookings[bookingStatus];

            if (!booking) {
                results.push({ type, status: bookingStatus, success: false, error: `No booking with status ${bookingStatus}` });
                continue;
            }

            try {
                // CRITICAL: Override the customer email to prevent sending to real customers
                const testBooking = { ...booking, customer_email: testEmail };
                console.log(`[test/send-emails] Sending ${type} email for booking ${booking.id} (${bookingStatus}) -> ${testEmail}`);
                await dispatchEmail(type, testBooking as BookingRecord);
                results.push({ type, status: bookingStatus, success: true });
                console.log(`[test/send-emails] ✓ Sent ${type} email`);
            } catch (error) {
                results.push({
                    type,
                    status: bookingStatus,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
                console.error(`[test/send-emails] ✗ Failed to send ${type} email:`, error);
            }

            // Small delay between emails to avoid rate limiting
            if (delayMs > 0) {
                await delay(delayMs);
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            testEmailUsed: testEmail,
            restaurantId,
            bookingsUsed: {
                pending: bookings.pending?.id ?? null,
                confirmed: bookings.confirmed?.id ?? null,
                completed: bookings.completed?.id ?? null,
                cancelled: bookings.cancelled?.id ?? null,
            },
            stats: {
                sent: successCount,
                failed: failedCount,
            },
            results,
            message: `Sent ${successCount} emails to ${testEmail}, ${failedCount} failed`,
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Failed to send emails',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const guard = guardTestEndpoint(req);
    if (guard) return guard;

    return NextResponse.json({
        description: 'Send all email types directly without queue (bypasses Redis)',
        availableEmailTypes: ALL_EMAIL_TYPES,
        emailTypeStatusRequirements: EMAIL_TYPE_STATUS_MAP,
        usage: {
            method: 'POST',
            body: {
                restaurantSlug: '(optional) slug of restaurant to find bookings from',
                emailTypes: '(optional) array of email types to send, defaults to all',
                delayMs: '(optional) delay between emails in ms, default 500',
                testEmail: `(optional) email to send all test emails to, default: ${DEFAULT_TEST_EMAIL}`,
            },
        },
    });
}
