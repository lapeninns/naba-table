import { QueueEvents, Worker } from "bullmq";

import { closeRedisConnection, getRedisConnection } from "@/lib/queue/redis";
import { recordObservabilityEvent } from "@/server/observability";
import { EMAIL_QUEUE_NAME, type EmailJobPayload, getEmailDlq } from "@/server/queue/email";
import { sendBookingConfirmationEmail } from "@/server/emails/bookings";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === "true" || process.env.SUPPRESS_EMAILS === "true";

const concurrency = (() => {
  const configured = Number.parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? "", 10);
  return Number.isFinite(configured) && configured > 0 ? configured : 5;
})();

async function processEmailJob(job: EmailJobPayload): Promise<void> {
  if (SUPPRESS_EMAILS) {
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.suppressed",
      context: {
        bookingId: job.bookingId,
        type: job.type,
      },
      restaurantId: job.restaurantId ?? undefined,
      bookingId: job.bookingId,
    });
    return;
  }

  const supabase = getServiceSupabaseClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", job.bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? String(error));
  }
  if (!booking) {
    throw new Error(`Booking ${job.bookingId} not found`);
  }

  const bookingRecord = booking as BookingRecord;

  switch (job.type) {
    case "request_received": {
      if (
        bookingRecord.status === "pending" ||
        bookingRecord.status === "pending_allocation"
      ) {
        await sendBookingConfirmationEmail(bookingRecord);
        await recordObservabilityEvent({
          source: "queue.email",
          eventType: "email_queue.delivered",
          restaurantId: job.restaurantId ?? bookingRecord.restaurant_id ?? undefined,
          bookingId: bookingRecord.id,
          context: {
            type: job.type,
            status: bookingRecord.status,
          },
        });
      } else {
        await recordObservabilityEvent({
          source: "queue.email",
          eventType: "email_queue.skipped",
          restaurantId: job.restaurantId ?? bookingRecord.restaurant_id ?? undefined,
          bookingId: bookingRecord.id,
          context: {
            type: job.type,
            status: bookingRecord.status,
            reason: "booking_no_longer_pending",
          },
        });
      }
      break;
    }
    default: {
      throw new Error(`Unsupported email job type: ${job.type}`);
    }
  }
}

async function main(): Promise<void> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (bullJob) => {
      await processEmailJob(bullJob.data);
    },
    {
      connection: getRedisConnection(),
      concurrency,
    },
  );

  const queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  worker.on("failed", async (bullJob, err) => {
    if (!bullJob) {
      return;
    }
    const attemptsAllowed = bullJob.opts.attempts ?? 1;
    const attemptsMade = bullJob.attemptsMade;
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.failed",
      severity: attemptsMade >= attemptsAllowed ? "error" : "warning",
      restaurantId: bullJob.data.restaurantId ?? undefined,
      bookingId: bullJob.data.bookingId,
      context: {
        attemptsMade,
        attemptsAllowed,
        type: bullJob.data.type,
        delay: bullJob.opts.delay ?? 0,
        error: err instanceof Error ? err.message : String(err),
      },
    });

    if (attemptsMade >= attemptsAllowed) {
      const dlq = getEmailDlq();
      await dlq.add(
        "email-dlq",
        {
          ...bullJob.data,
          failedReason: err instanceof Error ? err.message : String(err),
          failedAt: new Date().toISOString(),
        },
        { removeOnComplete: false, removeOnFail: false },
      );
    }
  });

  worker.on("completed", async (bullJob) => {
    if (!bullJob) return;
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.completed",
      restaurantId: bullJob.data.restaurantId ?? undefined,
      bookingId: bullJob.data.bookingId,
      context: {
        attemptsMade: bullJob.attemptsMade,
        durationMs: bullJob.finishedOn && bullJob.processedOn
          ? bullJob.finishedOn - bullJob.processedOn
          : undefined,
        type: bullJob.data.type,
      },
    });
  });

  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    await recordObservabilityEvent({
      source: "queue.email",
      eventType: "email_queue.event_failed",
      severity: "warning",
      context: {
        jobId,
        failedReason,
      },
    });
  });

  const shutdown = async (signal: string) => {
    console.info(`[queue][email] Shutting down worker (${signal})`);
    await worker.close();
    await queueEvents.close();
    await closeRedisConnection();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  console.log(`[queue][email] Worker started (concurrency=${concurrency})`);
}

void main().catch(async (error) => {
  console.error("[queue][email] Worker failed to start", error);
  await closeRedisConnection();
  process.exit(1);
});
