import { NextResponse } from "next/server";

import {
    sendBookingCancellationEmail,
    sendBookingConfirmationEmail,
    sendBookingRejectedEmail,
    sendBookingReminderEmail,
    sendBookingReviewRequestEmail,
    sendBookingUpdateEmail,
    sendRestaurantCancellationEmail,
} from "@/server/emails/bookings";
import { type EmailJobPayload, type EmailJobType } from "@/server/queue/email";
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
    // Vercel cron jobs automatically send CRON_SECRET in the Authorization header as Bearer token
    // See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
    const authHeader = request.headers.get("authorization");

    // Check if request has valid Bearer token (Vercel sends CRON_SECRET automatically)
    const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

    if (CRON_SECRET && !hasValidBearerToken) {
        console.warn("[cron][process-emails] Unauthorized request", {
            hasAuthHeader: !!authHeader,
            hasCronSecret: !!CRON_SECRET,
        });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If no CRON_SECRET is set, log a warning (endpoint is unprotected)
    if (!CRON_SECRET) {
        console.warn("[cron][process-emails] CRON_SECRET not set - endpoint is unprotected");
    }

    const { getEmailQueue } = await import("@/server/queue/email");
    const queue = getEmailQueue();
    const results: Array<{ jobId: string; success: boolean; skipped?: boolean; error?: string }> = [];

    try {
        const now = Date.now();

        // Get delayed jobs that are ready to be processed
        const delayedJobs = await queue.getDelayed(0, MAX_JOBS_PER_RUN * 2);

        // Filter to only jobs that are ready (scheduled time has passed)
        const readyJobs = delayedJobs.filter(job => {
            const processAt = job.timestamp + (job.opts.delay ?? 0);
            return processAt <= now;
        }).slice(0, MAX_JOBS_PER_RUN);

        if (readyJobs.length === 0) {
            // Also check waiting jobs
            const waitingJobs = await queue.getWaiting(0, MAX_JOBS_PER_RUN);
            if (waitingJobs.length === 0) {
                return NextResponse.json({
                    success: true,
                    message: "No pending emails to process",
                    processed: 0,
                    debug: {
                        delayedCount: delayedJobs.length,
                        waitingCount: 0,
                    }
                });
            }

            // Process waiting jobs
            for (const job of waitingJobs) {
                try {
                    const payload = job.data;
                    const result = await processJob(payload);

                    // Remove job after processing
                    await job.remove();

                    results.push({ jobId: job.id ?? "unknown", ...result });
                    console.log(`[cron][process-emails] Processed waiting job ${job.id}:`, result);
                } catch (error) {
                    console.error(`[cron][process-emails] Failed to process job ${job.id}:`, error);
                    results.push({
                        jobId: job.id ?? "unknown",
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        } else {
            // Process delayed jobs that are ready
            for (const job of readyJobs) {
                try {
                    const payload = job.data;
                    const result = await processJob(payload);

                    // Remove job after processing
                    await job.remove();

                    results.push({ jobId: job.id ?? "unknown", ...result });
                    console.log(`[cron][process-emails] Processed delayed job ${job.id}:`, result);
                } catch (error) {
                    console.error(`[cron][process-emails] Failed to process job ${job.id}:`, error);
                    results.push({
                        jobId: job.id ?? "unknown",
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
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
