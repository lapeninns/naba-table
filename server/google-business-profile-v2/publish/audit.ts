/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Audit event writer. Inserts immutable rows into
 * `gbp_sync_v2_publish_events`. The orchestrator stamps the resulting event
 * id back onto the publish job (`nabatable_event_id`, `google_event_id`,
 * `rollback_event_id`) so the audit trail is replayable.
 */


import { getSyncV2DbClient, type SyncV2PublishEventRow } from '../db';

import type {
  SyncV2DirectionIntent,
  SyncV2GoogleUpdateMask,
  SyncV2PreflightNotice,
  SyncV2PublishLeg,
  SyncV2PublishResult,
  SyncV2SectionKey,
} from '../types';
import type { Json } from '@/types/supabase';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface WritePublishEventInput {
  readonly client: SupabaseClient<Database>;
  readonly publishJobId: string;
  readonly restaurantId: string;
  readonly direction: SyncV2DirectionIntent;
  readonly leg: SyncV2PublishLeg;
  readonly result: SyncV2PublishResult;
  readonly affectedSectionKeys?: ReadonlyArray<SyncV2SectionKey>;
  readonly googleUpdateMasks?: ReadonlyArray<SyncV2GoogleUpdateMask>;
  readonly oldValues?: Record<string, unknown>;
  readonly newValues?: Record<string, unknown>;
  readonly errors?: ReadonlyArray<SyncV2PreflightNotice>;
  readonly actorUserId?: string | null;
}

export async function writePublishEvent(input: WritePublishEventInput): Promise<string> {
  const v2 = getSyncV2DbClient(input.client);
  const insert: Partial<SyncV2PublishEventRow> = {
    publish_job_id: input.publishJobId,
    restaurant_id: input.restaurantId,
    direction: input.direction,
    leg: input.leg,
    result: input.result,
    affected_section_keys: input.affectedSectionKeys ? [...input.affectedSectionKeys] : [],
    google_update_masks: input.googleUpdateMasks ? [...input.googleUpdateMasks] : [],
    old_values: (input.oldValues ?? {}) as unknown as Json,
    new_values: (input.newValues ?? {}) as unknown as Json,
    errors: (input.errors ?? []) as unknown as Json,
    actor_user_id: input.actorUserId ?? null,
  };
  const { data, error } = await v2
    .from('gbp_sync_v2_publish_events')
    .insert(insert as never)
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to write V2 publish event (job=${input.publishJobId}, leg=${input.leg}): ${error?.message ?? 'no row returned'}`,
    );
  }
  return (data as unknown as { id: string }).id;
}
