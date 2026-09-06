import 'server-only';

import { logger } from '@/lib/logger';
import { enqueueCheckOutSideEffects } from '@/server/jobs/booking-side-effects';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Jobs are inserted by the booking completion transaction, not by a best-effort callback. */
export async function drainReviewSchedulingJobs(
  options: {
    limit?: number;
    client?: SupabaseClient<Database>;
  } = {},
): Promise<{ processed: number; failed: number }> {
  const client = options.client ?? getServiceSupabaseClient();
  const { data: jobs, error } = await client.rpc('claim_review_scheduling_jobs_v1', {
    p_limit: options.limit ?? 50,
  });
  if (error) throw new Error('Failed to claim review scheduling jobs.');
  let processed = 0;
  let failed = 0;
  for (const job of jobs ?? []) {
    let failure: string | null = null;
    try {
      const { data: booking, error: readError } = await client
        .from('bookings')
        .select('*')
        .eq('id', job.booking_id)
        .eq('restaurant_id', job.restaurant_id)
        .maybeSingle();
      if (readError || !booking) throw new Error('Review booking unavailable.');
      // A reopened/cancelled booking is no longer eligible. Never replay lifecycle changes.
      if (booking.status === 'completed') {
        await enqueueCheckOutSideEffects(booking, job.restaurant_id, {
          supabase: client,
          retryOnFailure: true,
        });
      }
    } catch (error) {
      // Persist only a bounded SQLSTATE, never provider messages or guest details.
      const code =
        error && typeof error === 'object' && 'databaseCode' in error ? error.databaseCode : null;
      failure = typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? code : 'scheduling_failed';
      logger.warn('Review scheduling failed; durable job retained for retry.', {
        bookingId: job.booking_id,
        restaurantId: job.restaurant_id,
        errorCode: failure,
      });
    }
    const result = await client.rpc('finish_review_scheduling_job_v1', {
      p_booking_id: job.booking_id,
      p_restaurant_id: job.restaurant_id,
      p_claim_token: job.claim_token,
      p_error_code: failure,
    });
    if (result.error || !result.data) {
      failed += 1;
      logger.warn('Review scheduling claim could not be finalized.', {
        bookingId: job.booking_id,
        restaurantId: job.restaurant_id,
      });
    } else if (failure) failed += 1;
    else processed += 1;
  }
  return { processed, failed };
}
