import { Worker } from "bullmq";

import { getRedisConnection, closeRedisConnection } from "@/lib/queue/redis";
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingRejectedEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
  sendBookingUpdateEmail,
  sendRestaurantCancellationEmail,
} from "@/server/emails/bookings";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";
import { EMAIL_QUEUE_NAME, getEmailDlq, type EmailJobPayload, type EmailJobType } from "@/server/queue/email";

import type { BookingRecord } from "@/server/bookings";

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === "true" || process.env.SUPPRESS_EMAILS === "true";

const DEFAULT_CONCURRENCY = 5;

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes("@"));
}

async function fetchBooking(bookingId: string): Promise<BookingRecord | null> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) {
    console.error("[queue][email-worker] failed to fetch booking", {
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
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported email job type: ${exhaustiveCheck}`);
    }
  }
}

async function processJob(payload: EmailJobPayload): Promise<void> {
  if (SUPPRESS_EMAILS) {
    return;
  }

  const booking = await fetchBooking(payload.bookingId);
  if (!booking) {
    console.warn("[queue][email-worker] booking missing; skipping", {
      bookingId: payload.bookingId,
      type: payload.type,
    });
    return;
  }

  if (!isValidEmail(booking.customer_email)) {
    console.warn("[queue][email-worker] invalid recipient; skipping", {
      bookingId: booking.id,
      type: payload.type,
    });
    return;
  }

  if (!shouldSendByStatus(payload.type, booking)) {
    console.log("[queue][email-worker] status guard skipped", {
      bookingId: booking.id,
      type: payload.type,
      status: booking.status ?? null,
    });
    return;
  }

  await dispatchEmail(payload.type, booking);
}

const worker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    await processJob(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: DEFAULT_CONCURRENCY,
  },
);

worker.on("failed", async (job, error) => {
  if (!job) {
    return;
  }
  const attempts = job.opts.attempts ?? 1;
  const isFinalAttempt = job.attemptsMade >= attempts;
  const errorMessage = error instanceof Error ? error.message : String(error);

  await recordObservabilityEvent({
    source: "queue.email.worker",
    eventType: "email_queue.job_failed",
    severity: "error",
    context: {
      jobId: job.id,
      bookingId: job.data.bookingId,
      type: job.data.type,
      attemptsMade: job.attemptsMade,
      attempts,
      error: errorMessage,
    },
    restaurantId: job.data.restaurantId ?? undefined,
    bookingId: job.data.bookingId,
  });

  if (!isFinalAttempt) {
    return;
  }

  try {
    const dlq = getEmailDlq();
    await dlq.add(
      "failed-booking-email",
      {
        ...job.data,
        failedAt: new Date().toISOString(),
        failedReason: errorMessage,
      },
      {
        jobId: `failed:${job.id ?? job.data.bookingId}`,
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
  } catch (dlqError) {
    console.warn("[queue][email-worker] failed to enqueue DLQ", {
      jobId: job.id,
      error: dlqError instanceof Error ? dlqError.message : String(dlqError),
    });
  }
});

async function shutdown(signal: "SIGINT" | "SIGTERM"): Promise<void> {
  console.log(`[queue][email-worker] shutting down (${signal})`);
  await worker.close();
  await closeRedisConnection();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

console.log("[queue][email-worker] started");
