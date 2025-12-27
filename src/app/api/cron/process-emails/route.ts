import { NextResponse } from "next/server";

import { getRedisConnection } from "@/lib/queue/redis";
import {
    sendBookingCancellationEmail,
    sendBookingConfirmationEmail,
    sendBookingRejectedEmail,
    sendBookingReminderEmail,
    sendBookingReviewRequestEmail,
    sendBookingUpdateEmail,
    sendRestaurantCancellationEmail,
} from "@/server/emails/bookings";
import { EMAIL_QUEUE_NAME, type EmailJobPayload, type EmailJobType } from "@/server/queue/email";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";

// Vercel cron jobs have a 10s timeout on hobby, 60s on pro
// Process jobs in batches to stay within limits
const MAX_JOBS_PER_RUN = 10;
const CRON_SECRET = process.env.CRON_SECRET;

function isValidEmail(value?: string | null): boolean {
    return Boolean(value && value.trim().length > 3 && value.includes("@"));
}

async function fetchBooking(bookingId: string): Promise<BookingRecord | null> {
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (error) {
        console.error("[cron][process-emails] failed to fetch booking", {
            bookingId,
            error: error.message,
        });
        return null;
    }
    return (data ?? null) as BookingRecord | null;
}

function shouldSendByStatus(type: EmailJobType, booking: BookingRecord): boolean {
    const status = booking.status ?? null;
    switch (type) {
        case "request_received":
            return status === "pending" || status === "pending_allocation";
        case "confirmation":
            return status === "confirmed";
        case "reminder_24h":
        case "reminder_short":
            return status === "confirmed";
        case "review_request":
            return status === "completed";
        case "cancelled":
        case "restaurant_cancellation":
            return status === "cancelled";
        case "booking_rejected":
            return true;
        case "updated":
            return true;
        default:
            return false;
    }
}

async function dispatchEmail(type: EmailJobType, booking: BookingRecord): Promise<void> {
    switch (type) {
        case "request_received":
        case "confirmation":
            await sendBookingConfirmationEmail(booking);
            return;
        case "reminder_24h":
            await sendBookingReminderEmail(booking, { variant: "standard" });
            return;
        case "reminder_short":
            await sendBookingReminderEmail(booking, { variant: "short" });
            return;
        case "review_request":
            await sendBookingReviewRequestEmail(booking);
            return;
        case "updated":
            await sendBookingUpdateEmail(booking);
            return;
        case "cancelled":
            await sendBookingCancellationEmail(booking);
            return;
        case "restaurant_cancellation":
            await sendRestaurantCancellationEmail(booking);
            return;
        case "booking_rejected":
            await sendBookingRejectedEmail(booking);
            return;
        default: {
            console.warn(`[cron][process-emails] Unknown email type: ${type}`);
        }
    }
}

async function processJob(payload: EmailJobPayload): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
    const booking = await fetchBooking(payload.bookingId);
    if (!booking) {
        return { success: true, skipped: true }; // Skip missing bookings
    }

    if (!isValidEmail(booking.customer_email)) {
        return { success: true, skipped: true }; // Skip invalid emails
    }

    if (!shouldSendByStatus(payload.type, booking)) {
        return { success: true, skipped: true }; // Status changed, skip
    }

    try {
        await dispatchEmail(payload.type, booking);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    // Vercel cron jobs send the secret in the 'x-vercel-cron-signature' or 'authorization' header
    const authHeader = request.headers.get("authorization");
    const vercelCronHeader = request.headers.get("x-vercel-cron-signature");

    // Check if this is a Vercel cron request or has valid Bearer token
    const isVercelCron = vercelCronHeader !== null;
    const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

    if (CRON_SECRET && !isVercelCron && !hasValidBearerToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redis = getRedisConnection();
    const results: Array<{ jobId: string; success: boolean; skipped?: boolean; error?: string }> = [];

    try {
        // Get jobs that are ready to be processed (score <= current timestamp)
        const now = Date.now();

        // Check delayed jobs that are ready
        const delayedKey = `bull:${EMAIL_QUEUE_NAME}:delayed`;
        const readyJobs = await redis.zrangebyscore(delayedKey, 0, now, "LIMIT", 0, MAX_JOBS_PER_RUN);

        if (readyJobs.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No pending emails to process",
                processed: 0,
            });
        }

        for (const jobId of readyJobs) {
            try {
                // Get job data
                const jobKey = `bull:${EMAIL_QUEUE_NAME}:${jobId}`;
                const jobData = await redis.hget(jobKey, "data");

                if (!jobData) {
                    // Job doesn't exist, remove from delayed set
                    await redis.zrem(delayedKey, jobId);
                    continue;
                }

                const payload: EmailJobPayload = JSON.parse(jobData);
                const result = await processJob(payload);

                // Remove job from delayed set and delete job data
                await redis.zrem(delayedKey, jobId);
                await redis.del(jobKey);

                results.push({ jobId, ...result });

                console.log(`[cron][process-emails] Processed job ${jobId}:`, result);
            } catch (error) {
                console.error(`[cron][process-emails] Failed to process job ${jobId}:`, error);
                results.push({
                    jobId,
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        const successCount = results.filter(r => r.success && !r.skipped).length;
        const skippedCount = results.filter(r => r.skipped).length;
        const failedCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            message: `Processed ${results.length} jobs`,
            stats: {
                sent: successCount,
                skipped: skippedCount,
                failed: failedCount,
            },
            results,
        });
    } catch (error) {
        console.error("[cron][process-emails] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
