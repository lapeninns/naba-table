import {
  buildDefaultNotificationPort,
  createSupabaseGoogleWriteTerminalNoticePersistence,
  deliverClaimedGoogleWriteNotices,
  getGoogleWriteTerminalNoticeCensus,
  reconcileGoogleWriteTerminalNotices,
} from '@/server/dual-sync/notifications';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';
import { requireCronAuthAndRun } from '@/server/security/cron-auth';
import { getServiceSupabaseClient } from '@/server/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOB_NAME = 'dual-sync.notifications';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function boundedLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
}

export async function GET(request: Request) {
  const response = await requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    const now = new Date().toISOString();
    const limit = boundedLimit(new URL(request.url).searchParams.get('limit'));
    const client = getServiceSupabaseClient();
    const notification = buildDefaultNotificationPort();
    try {
      const reconciliation = await reconcileGoogleWriteTerminalNotices({ client, limit, now });
      const delivery = await deliverClaimedGoogleWriteNotices({
        persistence: createSupabaseGoogleWriteTerminalNoticePersistence(client),
        notification,
        workerId: auth.runId,
        now,
        limit,
        leaseSeconds: 60,
      });
      const census = await getGoogleWriteTerminalNoticeCensus({
        client,
        restaurantId: null,
        now,
      });
      if (census.overdue_count > 0) {
        await notification.emit({
          kind: 'google_write_notice_overdue',
          severity: 'error',
          summary: 'Google write terminal notices exceeded the delivery SLA.',
          counts: { failed: census.overdue_count },
          occurredAt: now,
          metadata: { overdueCount: census.overdue_count },
        });
      }
      if (census.dispatched_count > 0 || census.outcome_unknown_count > 0) {
        await notification.emit({
          kind: 'google_write_notice_delivery_uncertain',
          severity: 'error',
          summary: 'Google write operational notice delivery requires operator review.',
          counts: { failed: census.outcome_unknown_count, other: census.dispatched_count },
          occurredAt: now,
          metadata: {
            dispatchedCount: census.dispatched_count,
            outcomeUnknownCount: census.outcome_unknown_count,
            instruction: 'check_in_app_notice_and_verify_operational_channel',
          },
        });
      }
      return gbpNoStoreJson({
        success: true,
        runId: auth.runId,
        limit,
        reconciliation,
        delivery,
        census,
        asOf: now,
      });
    } catch {
      return gbpNoStoreJson(
        { error: 'Dual-sync terminal notification delivery failed.' },
        { status: 500 },
      );
    }
  });
  return gbpNoStoreResponse(response);
}
