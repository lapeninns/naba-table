import { z } from 'zod';

import { isManageLinkEligibleBooking } from '@/server/bookings/manage-link-eligibility';
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingManageLinkEmail,
  sendBookingRejectedEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
  sendBookingUpdateEmail,
  sendRestaurantCancellationEmail,
} from '@/server/emails/bookings';
import { EMAIL_JOB_TYPE_VALUES } from '@/server/queue/email-contract';
import { canSendReviewRequest, recordReviewRequestEvent } from '@/server/reviews/journeys';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { EmailJobPayload, EmailJobType } from '@/server/queue/email-contract';

const emailJobTypeSchema = z.enum(EMAIL_JOB_TYPE_VALUES);

export const emailJobPayloadSchema = z.object({
  bookingId: z.string().min(1),
  restaurantId: z.string().uuid().nullable(),
  type: emailJobTypeSchema,
  scheduledFor: z.string().datetime().nullable().optional(),
  failedReason: z.string().nullable().optional(),
  failedAt: z.string().datetime().nullable().optional(),
  cronAttemptsMade: z.number().int().min(0).nullable().optional(),
  reviewRequestId: z.string().min(1).nullable().optional(),
  reviewStage: z.enum(['primary', 'followup']).nullable().optional(),
});

export const emailJobEnvelopeSchema = z.object({
  id: z.string().min(1),
  payload: emailJobPayloadSchema,
});

export const processEmailJobsRequestSchema = z.object({
  jobs: z.array(emailJobEnvelopeSchema).min(1).max(100),
});

export type EmailJobEnvelope = z.infer<typeof emailJobEnvelopeSchema>;
export type ProcessEmailJobsRequest = z.infer<typeof processEmailJobsRequestSchema>;

export type ProcessEmailJobResult = {
  jobId: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
};

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
}

async function fetchBooking(bookingId: string): Promise<BookingRecord | null> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('[queue][email-processing] failed to fetch booking', {
      bookingId,
      error: error.message,
    });
    return null;
  }

  return (data ?? null) as BookingRecord | null;
}

function shouldSendByStatus(type: EmailJobType, booking: BookingRecord): boolean {
  const status = booking.status ?? null;
  const now = Date.now();

  switch (type) {
    case 'request_received':
      return status === 'pending' || status === 'pending_allocation';
    case 'confirmation':
      return status === 'confirmed';
    case 'reminder_24h':
    case 'reminder_short':
      if (status !== 'confirmed') return false;
      if (booking.start_at) {
        const startAt = new Date(booking.start_at).getTime();
        if (Number.isFinite(startAt) && now >= startAt) return false;
      }
      return true;
    case 'review_request':
      if (status !== 'completed') return false;
      if (booking.end_at) {
        const endAt = new Date(booking.end_at).getTime();
        if (Number.isFinite(endAt) && now - endAt > 30 * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    case 'cancelled':
    case 'restaurant_cancellation':
      return status === 'cancelled';
    case 'booking_rejected':
    case 'updated':
      return true;
    case 'manage_link':
      // Same predicate the lost-link request uses to pick bookings, so a
      // booking that was eligible when requested is still sent.
      return isManageLinkEligibleBooking(booking, new Date(now));
    default:
      return false;
  }
}

async function dispatchEmail(
  type: EmailJobType,
  booking: BookingRecord,
  jobId: string,
): Promise<void> {
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
    case 'manage_link':
      // The recipient is always the booking's stored address (never request
      // input); the job id makes each lost-link send a distinct provider send.
      await sendBookingManageLinkEmail(booking, { nonce: jobId });
      return;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported email job type: ${exhaustive}`);
    }
  }
}

export async function processEmailJob(job: EmailJobEnvelope): Promise<ProcessEmailJobResult> {
  try {
    const payload: EmailJobPayload = emailJobPayloadSchema.parse(job.payload);
    const booking = await fetchBooking(payload.bookingId);

    if (!booking) {
      return { jobId: job.id, success: true, skipped: true };
    }

    if (booking.restaurant_id !== payload.restaurantId) {
      console.warn('[queue][email-processing] skipped tenant-mismatched email job', {
        jobId: job.id,
        bookingId: payload.bookingId,
        type: payload.type,
      });
      return { jobId: job.id, success: true, skipped: true };
    }

    if (!isValidEmail(booking.customer_email)) {
      return { jobId: job.id, success: true, skipped: true };
    }

    if (!shouldSendByStatus(payload.type, booking)) {
      return { jobId: job.id, success: true, skipped: true };
    }

    if (payload.type === 'review_request' && payload.reviewRequestId) {
      const trackingClient = getServiceSupabaseClient();
      const permitted = await canSendReviewRequest(
        {
          channel: 'email',
          restaurantId: payload.restaurantId,
          reviewRequestId: payload.reviewRequestId,
        },
        trackingClient,
      );
      if (!permitted) {
        return { jobId: job.id, success: true, skipped: true };
      }

      const delivery = await sendBookingReviewRequestEmail(booking);
      if (!delivery) {
        return { jobId: job.id, success: true, skipped: true };
      }
      const linkage = await trackingClient
        .from('email_delivery_log')
        .update({ review_request_id: payload.reviewRequestId })
        .eq('id', delivery.id);
      if (linkage.error) {
        console.warn('[queue][email-processing] review delivery linkage failed', {
          bookingId: payload.bookingId,
          jobId: job.id,
        });
      }
      try {
        await recordReviewRequestEvent(
          {
            channel: 'email',
            eventType: 'sent',
            idempotencyKey: `review:${payload.reviewRequestId}:email:${payload.reviewStage ?? 'primary'}:sent`,
            occurredAt: delivery.occurredAt ?? new Date().toISOString(),
            provider: delivery.provider === 'resend' ? 'resend' : 'nabatable',
            providerEventId: delivery.messageId,
            restaurantId: payload.restaurantId,
            reviewRequestId: payload.reviewRequestId,
          },
          trackingClient,
        );
      } catch {
        console.warn('[queue][email-processing] review sent event recording failed', {
          bookingId: payload.bookingId,
          jobId: job.id,
        });
      }
      return { jobId: job.id, success: true };
    }

    await dispatchEmail(payload.type, booking, job.id);
    return { jobId: job.id, success: true };
  } catch (error) {
    console.warn('[queue][email-processing] job failed', {
      jobId: job.id,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      jobId: job.id,
      success: false,
      error: 'EMAIL_JOB_FAILED',
    };
  }
}

export async function processEmailJobs(jobs: EmailJobEnvelope[]): Promise<{
  processed: number;
  stats: { sent: number; skipped: number; failed: number };
  results: ProcessEmailJobResult[];
}> {
  const results: ProcessEmailJobResult[] = [];

  for (const job of jobs) {
    results.push(await processEmailJob(job));
  }

  return {
    processed: results.length,
    stats: {
      sent: results.filter((result) => result.success && !result.skipped).length,
      skipped: results.filter((result) => result.skipped).length,
      failed: results.filter((result) => !result.success).length,
    },
    results,
  };
}
