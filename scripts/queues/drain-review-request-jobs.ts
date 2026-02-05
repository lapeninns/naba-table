import 'tsconfig-paths/register';
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { BookingRecord } from '@/server/bookings';
import type { EmailJobPayload } from '@/server/queue/email';

const projectRoot = process.cwd();
const envPath = process.env.ENV_PATH
  ? path.resolve(projectRoot, process.env.ENV_PATH)
  : path.join(projectRoot, '.env.vercel-production');

if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath, override: false });
}

const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';

const MAX_JOBS = Number.parseInt(process.env.MAX_JOBS ?? '50', 10);
const DELAYED_SCAN_LIMIT = Number.parseInt(process.env.DELAYED_SCAN_LIMIT ?? '500', 10);

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
}

async function fetchBooking(bookingId: string): Promise<BookingRecord | null> {
  const { getServiceSupabaseClient } = await import('@/server/supabase');
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) {
    console.error('[drain-review][fetch-booking]', {
      bookingId,
      error: error.message,
    });
    return null;
  }
  return (data ?? null) as BookingRecord | null;
}

function isDue(job: { timestamp: number; opts?: { delay?: number } }, now: number): boolean {
  const delay = job.opts?.delay ?? 0;
  return job.timestamp + delay <= now;
}

async function main(): Promise<void> {
  if (SUPPRESS_EMAILS) {
    console.log('[drain-review] SUPPRESS_EMAILS enabled; aborting.');
    return;
  }

  if (!Number.isFinite(MAX_JOBS) || MAX_JOBS <= 0) {
    throw new Error('MAX_JOBS must be a positive integer.');
  }

  const { sendBookingReviewRequestEmail } = await import('@/server/emails/bookings');
  const { getEmailQueue } = await import('@/server/queue/email');
  const { closeRedisConnection } = await import('@/lib/queue/redis');

  const queue = getEmailQueue();

  try {
    const now = Date.now();

    const waitingJobs = await queue.getJobs(['wait'], 0, MAX_JOBS - 1, true);
    const delayedJobs = await queue.getJobs(
      ['delayed'],
      0,
      Math.max(0, DELAYED_SCAN_LIMIT - 1),
      true,
    );

    const reviewWaiting = waitingJobs.filter((job) => job.data.type === 'review_request');
    const reviewDelayed = delayedJobs.filter(
      (job) => job.data.type === 'review_request' && isDue(job, now),
    );

    const candidates = [...reviewWaiting, ...reviewDelayed].slice(0, MAX_JOBS);

    console.log('[drain-review] candidate jobs', {
      waitingMatched: reviewWaiting.length,
      delayedMatched: reviewDelayed.length,
      totalSelected: candidates.length,
    });

    const results: Array<{ jobId: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }> = [];

    for (const job of candidates) {
      const payload = job.data as EmailJobPayload;
      const jobId = job.id?.toString() ?? 'unknown';

      try {
        const booking = await fetchBooking(payload.bookingId);
        if (!booking) {
          await job.remove();
          results.push({ jobId, status: 'skipped', reason: 'booking_missing' });
          continue;
        }

        if (!isValidEmail(booking.customer_email)) {
          await job.remove();
          results.push({ jobId, status: 'skipped', reason: 'invalid_email' });
          continue;
        }

        if (booking.status !== 'completed') {
          await job.remove();
          results.push({ jobId, status: 'skipped', reason: `status_${booking.status ?? 'unknown'}` });
          continue;
        }

        await sendBookingReviewRequestEmail(booking);
        await job.remove();
        results.push({ jobId, status: 'sent' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[drain-review] failed', { jobId, error: message });
        results.push({ jobId, status: 'failed', reason: message });
      }
    }

    const summary = {
      processed: results.length,
      sent: results.filter((r) => r.status === 'sent').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };

    console.log('[drain-review] summary', summary);
  } finally {
    await closeRedisConnection();
  }
}

main()
  .catch((error) => {
    console.error('[drain-review] fatal', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
