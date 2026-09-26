import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from '@/server/auth/guards';
import { getEmailQueueStatus, type QueueJobSummary } from '@/server/queue/email';
import { getServiceSupabaseClient } from '@/server/supabase';
import {
  OPS_EMAIL_QUEUE_JOB_STATUS_VALUES,
  type OpsEmailQueueFeedResponse,
  type OpsEmailQueueJobBookingDTO,
  type OpsEmailQueueJobDTO,
  type OpsEmailQueueJobStatus,
} from '@/types/emailQueue';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/ops/email-queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_STATUS_VALUES = OPS_EMAIL_QUEUE_JOB_STATUS_VALUES;

const querySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  fixture: z.string().trim().min(1).optional(),
  queueFixture: z.string().trim().min(1).optional(),
});

function normalizeFixture(
  rawFixture: string | undefined,
  rawQueueFixture: string | undefined,
): string | null {
  const fixture = rawQueueFixture?.trim() || rawFixture?.trim();
  return fixture ? fixture : null;
}

async function applyQueueFixtureDelay(fixture: string | null) {
  if (fixture !== 'loading') return;
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.APP_ENV !== 'development' &&
    process.env.APP_ENV !== 'test'
  ) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1200));
}

function jsonError(
  status: number,
  payload: Omit<Extract<OpsEmailQueueFeedResponse, { ok: false }>, 'ok'> & { message?: string },
) {
  return NextResponse.json(
    {
      ok: false,
      ...payload,
      message: payload.message ?? payload.error,
    } satisfies OpsEmailQueueFeedResponse & { message: string },
    { status },
  );
}

function parseStatus(
  raw: string | null,
): { ok: true; status: OpsEmailQueueJobStatus | null } | { ok: false } {
  if (!raw) {
    return { ok: true, status: null };
  }

  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return { ok: true, status: null };
  }

  if (!JOB_STATUS_VALUES.includes(normalized as OpsEmailQueueJobStatus)) {
    return { ok: false };
  }

  return { ok: true, status: normalized as OpsEmailQueueJobStatus };
}

function flattenQueueJobs(
  jobs: NonNullable<Awaited<ReturnType<typeof getEmailQueueStatus>>['queue']['jobs']>,
): OpsEmailQueueJobDTO[] {
  const delayed = (jobs.delayed ?? []).map((job) => toJobDto(job, 'delayed'));
  const waiting = (jobs.waiting ?? []).map((job) => toJobDto(job, 'waiting'));
  const active = (jobs.active ?? []).map((job) => toJobDto(job, 'active'));
  const dlqSource = jobs.dlq ?? jobs.failed ?? [];
  const dlq = dlqSource.map((job) => toJobDto(job, 'dlq'));

  return [...delayed, ...waiting, ...active, ...dlq];
}

function toJobDto(job: QueueJobSummary, status: OpsEmailQueueJobStatus): OpsEmailQueueJobDTO {
  return {
    id: job.id,
    status,
    type: job.payload.type,
    bookingId: job.payload.bookingId,
    restaurantId: job.payload.restaurantId ?? null,
    scheduledFor: job.scheduledFor ?? job.payload.scheduledFor ?? null,
    failedReason: job.payload.failedReason ?? null,
    failedAt: job.payload.failedAt ?? null,
    attemptsMade: job.payload.cronAttemptsMade ?? null,
    booking: null,
  };
}

const STATUS_SORT_ORDER: Record<OpsEmailQueueJobStatus, number> = {
  delayed: 0,
  waiting: 1,
  active: 2,
  dlq: 3,
};

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortJobs(a: OpsEmailQueueJobDTO, b: OpsEmailQueueJobDTO): number {
  const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
  if (statusDiff !== 0) return statusDiff;

  const aTime = parseIsoMs(a.scheduledFor) ?? parseIsoMs(a.failedAt) ?? Number.POSITIVE_INFINITY;
  const bTime = parseIsoMs(b.scheduledFor) ?? parseIsoMs(b.failedAt) ?? Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;

  return a.id.localeCompare(b.id);
}

function totalForStatus(
  summary: Record<'total' | OpsEmailQueueJobStatus, number>,
  status: OpsEmailQueueJobStatus | null,
) {
  return status ? summary[status] : summary.total;
}

async function loadBookingMap(
  restaurantId: string,
  bookingIds: string[],
): Promise<Map<string, OpsEmailQueueJobBookingDTO>> {
  if (bookingIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('id, reference, customer_name, customer_email, start_at, end_at, status')
    .eq('restaurant_id', restaurantId)
    .in('id', bookingIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((booking) => [
      booking.id,
      {
        id: booking.id,
        reference: booking.reference,
        customerName: booking.customer_name ?? null,
        customerEmail: booking.customer_email ?? null,
        startAt: booking.start_at ?? null,
        endAt: booking.end_at ?? null,
        status: booking.status ?? null,
      } satisfies OpsEmailQueueJobBookingDTO,
    ]),
  );
}

export async function GET(request: NextRequest) {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsedQuery = querySchema.safeParse(entries);
  if (!parsedQuery.success) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid query' });
  }

  const parsedStatus = parseStatus(request.nextUrl.searchParams.get('status'));
  if (!parsedStatus.ok) {
    return jsonError(400, { code: 'INTERNAL', error: 'Invalid queue status filter' });
  }

  const queueFixture = normalizeFixture(parsedQuery.data.fixture, parsedQuery.data.queueFixture);

  try {
    const { supabase, user } = await requireSession();

    const memberships = await listUserRestaurantMemberships(supabase, user.id);
    const fallbackRestaurantId =
      memberships.find(
        (membership) =>
          typeof membership.restaurant_id === 'string' && membership.restaurant_id.length > 0,
      )?.restaurant_id ?? null;

    const restaurantId = parsedQuery.data.restaurantId ?? fallbackRestaurantId;
    if (!restaurantId) {
      return jsonError(403, { code: 'FORBIDDEN', error: 'No restaurant access' });
    }

    await requireRestaurantMember({
      supabase,
      userId: user.id,
      restaurantId,
    });

    await applyQueueFixtureDelay(queueFixture);

    const page = parsedQuery.data.page;
    const pageSize = parsedQuery.data.pageSize;
    const offset = (page - 1) * pageSize;
    const snapshot = await getEmailQueueStatus(true, {
      jobLimit: offset + pageSize,
      restaurantId,
    });
    const queueJobs = snapshot.queue.jobs ? flattenQueueJobs(snapshot.queue.jobs) : [];
    const restaurantJobs = queueJobs
      .filter((job) => job.restaurantId === restaurantId)
      .sort(sortJobs);

    const counts = snapshot.queue.counts;
    const dlqCount = counts.dlq ?? 0;
    const summary = {
      total: counts.waiting + counts.active + counts.delayed + dlqCount,
      waiting: counts.waiting,
      active: counts.active,
      delayed: counts.delayed,
      dlq: dlqCount,
    };

    const filteredJobs =
      parsedStatus.status === null
        ? restaurantJobs
        : restaurantJobs.filter((job) => job.status === parsedStatus.status);

    const pageJobs = filteredJobs.slice(offset, offset + pageSize);
    const total = totalForStatus(summary, parsedStatus.status);
    const bookingMap = await loadBookingMap(
      restaurantId,
      Array.from(new Set(pageJobs.map((job) => job.bookingId))),
    );

    const jobs = pageJobs.map((job) => ({
      ...job,
      booking: bookingMap.get(job.bookingId) ?? null,
    }));

    return NextResponse.json(
      {
        ok: true,
        restaurantId,
        pageInfo: {
          page,
          pageSize,
          hasNext: offset + pageSize < total,
          total,
        },
        summary,
        jobs,
        timestamp: snapshot.timestamp,
      } satisfies Extract<OpsEmailQueueFeedResponse, { ok: true }>,
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof GuardError) {
      const mapped =
        error.code === 'UNAUTHENTICATED'
          ? { status: 401 as const, code: 'UNAUTHENTICATED' as const, error: error.message }
          : error.code === 'FORBIDDEN'
            ? { status: 403 as const, code: 'FORBIDDEN' as const, error: error.message }
            : {
                status: error.status as 401 | 403 | 500,
                code: 'INTERNAL' as const,
                error: error.message,
              };
      return jsonError(mapped.status, { code: mapped.code, error: mapped.error });
    }

    logger.error('[ops/email-queue] unexpected error', {
      route: ROUTE,
      error: error instanceof Error ? error.message : String(error),
    });
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-email-queue' },
    });
    return jsonError(500, { code: 'INTERNAL', error: 'Internal error' });
  }
}
