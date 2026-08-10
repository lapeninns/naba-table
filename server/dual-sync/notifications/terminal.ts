import type { DualSyncNotificationPort } from './types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const TERMINAL_NOTICE_SLA_MS = 48 * 60 * 60 * 1000;

type GoogleWriteTerminalStatus = 'consumed' | 'failed' | 'outcome_unknown';

type MaterializeGoogleWriteTerminalNoticeInput = BuildGoogleWriteTerminalNoticeInput & {
  readonly eventId: string;
};

type ClaimedGoogleWriteTerminalNotice = {
  readonly noticeId: string;
  readonly restaurantId: string;
  readonly grantId: string;
  readonly leaseToken: string;
  readonly terminalKind: GoogleWriteTerminalStatus;
  readonly safeReasonCode: string;
  readonly terminalAt: string;
};

export interface GoogleWriteTerminalNoticePersistencePort {
  materialize?(input: {
    readonly restaurantId: string;
    readonly grantId: string;
    readonly eventId: string;
    readonly terminalKind: GoogleWriteTerminalStatus;
    readonly safeReasonCode: string;
    readonly terminalAt: string;
  }): Promise<{ readonly noticeId: string }>;
  recoverDispatched(input: { readonly limit: number; readonly now: string }): Promise<number>;
  claim(input: {
    readonly workerId: string;
    readonly limit: number;
    readonly leaseSeconds: number;
    readonly now: string;
  }): Promise<readonly ClaimedGoogleWriteTerminalNotice[]>;
  dispatch(input: {
    readonly restaurantId: string;
    readonly noticeId: string;
    readonly workerId: string;
    readonly leaseToken: string;
    readonly dispatchKey: string;
    readonly now: string;
  }): Promise<void>;
  finalize(input: {
    readonly restaurantId: string;
    readonly noticeId: string;
    readonly workerId: string;
    readonly leaseToken: string;
    readonly outcome: 'delivered' | 'retryable_failure' | 'terminal_failure' | 'outcome_unknown';
    readonly safeErrorCode: string | null;
    readonly now: string;
  }): Promise<void>;
}

type BuildGoogleWriteTerminalNoticeInput = {
  readonly restaurantId: string;
  readonly grantId: string;
  readonly status: GoogleWriteTerminalStatus;
  readonly reasonCode: string;
  readonly terminalAt: string;
};

export type GoogleWriteTerminalNotice = BuildGoogleWriteTerminalNoticeInput & {
  readonly instruction: 'none' | 'refresh_then_create_new_preview';
  readonly requiresFreshPreview: boolean;
  readonly slaDueAt: string;
};

export function buildGoogleWriteTerminalNotice(
  input: BuildGoogleWriteTerminalNoticeInput,
): GoogleWriteTerminalNotice {
  const terminalAt = new Date(input.terminalAt);
  if (Number.isNaN(terminalAt.getTime())) throw new RangeError('Invalid terminal timestamp.');
  const requiresFreshPreview = input.status === 'outcome_unknown';
  return {
    ...input,
    instruction: requiresFreshPreview ? 'refresh_then_create_new_preview' : 'none',
    requiresFreshPreview,
    slaDueAt: new Date(terminalAt.getTime() + TERMINAL_NOTICE_SLA_MS).toISOString(),
  };
}

export function terminalNoticeSla(input: {
  readonly deliveredAt: string | null;
  readonly dueAt: string;
  readonly now: string;
}): 'pending' | 'delivered' | 'overdue' {
  if (input.deliveredAt) return 'delivered';
  return new Date(input.now).getTime() > new Date(input.dueAt).getTime() ? 'overdue' : 'pending';
}

export async function materializeGoogleWriteTerminalNotice(
  input: MaterializeGoogleWriteTerminalNoticeInput,
  persistence: Pick<Required<GoogleWriteTerminalNoticePersistencePort>, 'materialize'>,
): Promise<{ readonly noticeId: string }> {
  return persistence.materialize({
    restaurantId: input.restaurantId,
    grantId: input.grantId,
    eventId: input.eventId,
    terminalKind: input.status,
    safeReasonCode: input.reasonCode,
    terminalAt: input.terminalAt,
  });
}

export async function deliverClaimedGoogleWriteNotices(input: {
  readonly persistence: Pick<
    GoogleWriteTerminalNoticePersistencePort,
    'recoverDispatched' | 'claim' | 'dispatch' | 'finalize'
  >;
  readonly notification: DualSyncNotificationPort;
  readonly workerId: string;
  readonly now: string;
  readonly limit?: number;
  readonly leaseSeconds?: number;
}): Promise<{
  readonly claimed: number;
  readonly delivered: number;
  readonly failed: number;
  readonly outcomeUnknown: number;
}> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
  const leaseSeconds = Math.min(Math.max(Math.trunc(input.leaseSeconds ?? 60), 15), 900);
  let outcomeUnknown = await input.persistence.recoverDispatched({ limit, now: input.now });
  const notices = await input.persistence.claim({
    workerId: input.workerId,
    limit,
    leaseSeconds,
    now: input.now,
  });
  let delivered = 0;
  let failed = 0;
  for (const notice of notices) {
    const presentation = buildGoogleWriteTerminalNotice({
      restaurantId: notice.restaurantId,
      grantId: notice.grantId,
      status: notice.terminalKind,
      reasonCode: notice.safeReasonCode,
      terminalAt: notice.terminalAt,
    });
    await input.persistence.dispatch({
      restaurantId: notice.restaurantId,
      noticeId: notice.noticeId,
      workerId: input.workerId,
      leaseToken: notice.leaseToken,
      dispatchKey: `gbp-terminal:${notice.noticeId}:${notice.leaseToken}`,
      now: input.now,
    });
    let delivery;
    try {
      delivery = await input.notification.emit({
        kind: 'google_write_terminal',
        severity: notice.terminalKind === 'consumed' ? 'info' : 'error',
        summary: 'Google write reached a terminal outcome.',
        restaurantId: notice.restaurantId,
        errorCode: notice.safeReasonCode,
        occurredAt: notice.terminalAt,
        metadata: {
          grantId: notice.grantId,
          status: notice.terminalKind,
          instruction: presentation.instruction,
          requiresFreshPreview: presentation.requiresFreshPreview,
          slaDueAt: presentation.slaDueAt,
        },
      });
    } catch {
      delivery = {
        outcome: 'ambiguous_failure' as const,
        safeErrorCode: 'notification_delivery_ambiguous',
      };
    }
    const outcome =
      delivery.outcome === 'confirmed_success'
        ? 'delivered'
        : delivery.outcome === 'ambiguous_failure'
          ? 'outcome_unknown'
          : delivery.retryable
            ? 'retryable_failure'
            : 'terminal_failure';
    await input.persistence.finalize({
      restaurantId: notice.restaurantId,
      noticeId: notice.noticeId,
      workerId: input.workerId,
      leaseToken: notice.leaseToken,
      outcome,
      safeErrorCode: delivery.outcome === 'confirmed_success' ? null : delivery.safeErrorCode,
      now: input.now,
    });
    if (outcome === 'delivered') delivered += 1;
    else if (outcome === 'outcome_unknown') outcomeUnknown += 1;
    else failed += 1;
  }
  return { claimed: notices.length, delivered, failed, outcomeUnknown };
}

export async function emitOverdueGoogleWriteNotice(input: {
  readonly notification: DualSyncNotificationPort;
  readonly restaurantId: string;
  readonly grantId: string;
  readonly status: GoogleWriteTerminalStatus;
  readonly reasonCode: string;
  readonly dueAt: string;
}): Promise<void> {
  await input.notification.emit({
    kind: 'google_write_notice_overdue',
    severity: 'error',
    summary: 'Google write terminal notice exceeded its delivery SLA.',
    restaurantId: input.restaurantId,
    errorCode: input.reasonCode,
    metadata: { grantId: input.grantId, status: input.status, dueAt: input.dueAt },
  });
}

function terminalKind(value: string): GoogleWriteTerminalStatus {
  if (value === 'consumed' || value === 'failed' || value === 'outcome_unknown') return value;
  throw new Error('Google terminal notice returned an invalid terminal kind.');
}

export function createSupabaseGoogleWriteTerminalNoticePersistence(
  client: SupabaseClient<Database>,
): Required<GoogleWriteTerminalNoticePersistencePort> {
  return {
    async materialize(input) {
      const result = await client.rpc('materialize_gbp_terminal_notice_v1', {
        p_restaurant_id: input.restaurantId,
        p_grant_id: input.grantId,
        p_event_id: input.eventId,
        p_terminal_kind: input.terminalKind,
        p_safe_reason_code: input.safeReasonCode,
        p_terminal_at: input.terminalAt,
      });
      if (result.error) throw result.error;
      return { noticeId: result.data.id };
    },
    async recoverDispatched(input) {
      const result = await client.rpc('recover_stale_gbp_dispatched_notices_v1', {
        p_limit: input.limit,
        p_now: input.now,
      });
      if (result.error) throw result.error;
      return result.data.length;
    },
    async claim(input) {
      const result = await client.rpc('claim_gbp_terminal_notices_v1', {
        p_worker_id: input.workerId,
        p_limit: input.limit,
        p_lease_seconds: input.leaseSeconds,
        p_now: input.now,
      });
      if (result.error) throw result.error;
      return result.data.map((row) => {
        if (!row.lease_token) throw new Error('Claimed Google terminal notice has no lease token.');
        return {
          noticeId: row.id,
          restaurantId: row.restaurant_id,
          grantId: row.grant_id,
          leaseToken: row.lease_token,
          terminalKind: terminalKind(row.terminal_kind),
          safeReasonCode: row.safe_reason_code,
          terminalAt: row.terminal_at,
        };
      });
    },
    async dispatch(input) {
      const result = await client.rpc('dispatch_gbp_terminal_notice_v1', {
        p_restaurant_id: input.restaurantId,
        p_notice_id: input.noticeId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_dispatch_key: input.dispatchKey,
        p_now: input.now,
      });
      if (result.error) throw result.error;
    },
    async finalize(input) {
      const result = await client.rpc('finalize_gbp_terminal_notice_v1', {
        p_restaurant_id: input.restaurantId,
        p_notice_id: input.noticeId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_outcome: input.outcome,
        p_safe_error_code: input.safeErrorCode,
        p_now: input.now,
      });
      if (result.error) throw result.error;
    },
  };
}

export async function getGoogleWriteTerminalNoticeCensus(input: {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string | null;
  readonly now: string;
}): Promise<Database['public']['CompositeTypes']['gbp_terminal_notice_census_v1']> {
  const result = await input.client.rpc('get_gbp_terminal_notice_census_v1', {
    p_restaurant_id: input.restaurantId,
    p_now: input.now,
  });
  if (result.error) throw result.error;
  return result.data;
}

export async function reconcileGoogleWriteTerminalNotices(input: {
  readonly client: SupabaseClient<Database>;
  readonly limit?: number;
  readonly now?: string;
}): Promise<{
  readonly considered: number;
  readonly materialized: number;
  readonly failed: number;
}> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
  const result = await input.client.rpc('reconcile_missing_gbp_terminal_notices_v1', {
    p_limit: limit,
    p_now: input.now ?? new Date().toISOString(),
  });
  if (result.error) throw result.error;
  return { considered: result.data.length, materialized: result.data.length, failed: 0 };
}
