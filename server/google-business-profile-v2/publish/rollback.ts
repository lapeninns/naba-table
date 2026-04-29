/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Rollback coordinator. V2's rollback contract is honest by design: it
 * records exactly what restore action was attempted, what succeeded, and
 * what failed, instead of pretending a partial restore brings the system
 * back to "before publish".
 *
 * Two rollback shapes:
 *  - `recoverable`: the orchestrator captured pre-state for the leg that
 *    failed and was able to write it back. The rollback event records the
 *    pre-state and post-state.
 *  - `unrecoverable`: a write succeeded against an external system (Google)
 *    but a downstream Nabatable record could not be saved. The rollback
 *    event records the failed restore attempt and the residual divergence
 *    between systems.
 */

import { writePublishEvent } from './audit';
import { setPublishJobStatus } from '../preflight/store';

import type {
  SyncV2DirectionIntent,
  SyncV2GoogleUpdateMask,
  SyncV2PreflightNotice,
  SyncV2SectionKey,
} from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordRollbackInput {
  readonly client: SupabaseClient<Database>;
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly direction: SyncV2DirectionIntent;
  readonly recoverable: boolean;
  readonly affectedSectionKeys: ReadonlyArray<SyncV2SectionKey>;
  readonly googleUpdateMasks: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly preState: Record<string, unknown>;
  readonly postState: Record<string, unknown>;
  readonly rollbackErrors: ReadonlyArray<SyncV2PreflightNotice>;
  readonly actorUserId: string | null;
}

export async function recordRollback({
  client,
  publishJobId,
  restaurantId,
  direction,
  recoverable,
  affectedSectionKeys,
  googleUpdateMasks,
  preState,
  postState,
  rollbackErrors,
  actorUserId,
}: RecordRollbackInput): Promise<string> {
  const result = recoverable && rollbackErrors.length === 0 ? 'success' : 'failed';
  const eventId = await writePublishEvent({
    client,
    publishJobId,
    restaurantId,
    direction,
    leg: 'rollback',
    result,
    affectedSectionKeys,
    googleUpdateMasks,
    oldValues: postState,
    newValues: preState,
    errors: rollbackErrors,
    actorUserId,
  });
  await setPublishJobStatus({
    client,
    jobId: publishJobId,
    status: 'rolled_back',
    patch: { rollback_event_id: eventId, errors: rollbackErrors as never },
  });
  return eventId;
}
