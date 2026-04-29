/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Decision store. Single source of truth for the V2 decision-first state
 * model. Backed by `gbp_sync_v2_decisions`. Listing returns rows in stable
 * `(sectionKey, fieldKey)` order so reducers and hash computations are
 * deterministic.
 */


import { getSyncV2DbClient, type SyncV2DecisionRow } from '../db';
import { isSyncV2DecisionAction, isSyncV2SectionKey } from '../types';

import type { SyncV2Decision, SyncV2DecisionInput, SyncV2SectionKey } from '../types';
import type { Json } from '@/types/supabase';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DecisionStoreContext {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly draftId: string;
}

export interface UpsertDecisionContext extends DecisionStoreContext {
  readonly decidedByUserId: string | null;
  readonly decisions: ReadonlyArray<SyncV2DecisionInput>;
}

function rowToDecision(row: SyncV2DecisionRow): SyncV2Decision {
  if (!isSyncV2SectionKey(row.section_key)) {
    throw new Error(
      `gbp_sync_v2_decisions row ${row.id} has unknown section_key=${row.section_key}`,
    );
  }
  if (!isSyncV2DecisionAction(row.action)) {
    throw new Error(`gbp_sync_v2_decisions row ${row.id} has unknown action=${row.action}`);
  }
  return {
    id: row.id,
    draftId: row.draft_id,
    sectionKey: row.section_key,
    fieldKey: row.field_key,
    action: row.action,
    nabatableValueHash: row.nabatable_value_hash,
    googleValueHash: row.google_value_hash,
    decidedByUserId: row.decided_by_user_id,
    decidedAt: row.decided_at,
  };
}

export async function listDecisionsForDraft({
  client,
  draftId,
}: DecisionStoreContext): Promise<ReadonlyArray<SyncV2Decision>> {
  const v2 = getSyncV2DbClient(client);
  const { data, error } = await v2
    .from('gbp_sync_v2_decisions')
    .select('*')
    .eq('draft_id', draftId)
    .order('section_key', { ascending: true })
    .order('field_key', { ascending: true });
  if (error) {
    throw new Error(`Failed to list V2 decisions for draft ${draftId}: ${error.message}`);
  }
  return (data ?? []).map(rowToDecision);
}

export async function upsertDecisions({
  client,
  restaurantId,
  draftId,
  decidedByUserId,
  decisions,
}: UpsertDecisionContext): Promise<ReadonlyArray<SyncV2Decision>> {
  if (decisions.length === 0) {
    return listDecisionsForDraft({ client, restaurantId, draftId });
  }
  const v2 = getSyncV2DbClient(client);
  const rows: Array<Partial<SyncV2DecisionRow>> = decisions.map((d) => ({
    draft_id: draftId,
    restaurant_id: restaurantId,
    section_key: d.sectionKey,
    field_key: d.fieldKey,
    action: d.action,
    nabatable_value_hash: d.nabatableValueHash,
    google_value_hash: d.googleValueHash,
    decided_by_user_id: decidedByUserId,
    decided_at: new Date().toISOString(),
  }));
  const { error } = await v2
    .from('gbp_sync_v2_decisions')
    .upsert(rows as never, { onConflict: 'draft_id,section_key,field_key' });
  if (error) {
    throw new Error(`Failed to upsert V2 decisions for draft ${draftId}: ${error.message}`);
  }
  return listDecisionsForDraft({ client, restaurantId, draftId });
}

export interface DeleteDecisionInput {
  readonly sectionKey: SyncV2SectionKey;
  readonly fieldKey: string;
}

export async function deleteDecisions({
  client,
  draftId,
  decisions,
}: DecisionStoreContext & {
  readonly decisions: ReadonlyArray<DeleteDecisionInput>;
}): Promise<void> {
  if (decisions.length === 0) return;
  const v2 = getSyncV2DbClient(client);
  for (const d of decisions) {
    const { error } = await v2
      .from('gbp_sync_v2_decisions')
      .delete()
      .eq('draft_id', draftId)
      .eq('section_key', d.sectionKey)
      .eq('field_key', d.fieldKey);
    if (error) {
      throw new Error(
        `Failed to delete V2 decision ${d.sectionKey}/${d.fieldKey} for draft ${draftId}: ${error.message}`,
      );
    }
  }
}

/**
 * Cast an unknown JSON payload into a typed decision array. Used by the
 * draft store when the persisted snapshot/diff JSON columns are read back.
 */
export function castJsonDecisions(value: Json): ReadonlyArray<SyncV2Decision> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const sectionKey = row.sectionKey;
      const fieldKey = row.fieldKey;
      const action = row.action;
      if (!isSyncV2SectionKey(sectionKey)) return null;
      if (!isSyncV2DecisionAction(action)) return null;
      if (typeof fieldKey !== 'string') return null;
      return {
        id: typeof row.id === 'string' ? row.id : '',
        draftId: typeof row.draftId === 'string' ? row.draftId : '',
        sectionKey,
        fieldKey,
        action,
        nabatableValueHash:
          typeof row.nabatableValueHash === 'string' ? row.nabatableValueHash : '',
        googleValueHash: typeof row.googleValueHash === 'string' ? row.googleValueHash : '',
        decidedByUserId: typeof row.decidedByUserId === 'string' ? row.decidedByUserId : null,
        decidedAt: typeof row.decidedAt === 'string' ? row.decidedAt : '',
      } satisfies SyncV2Decision;
    })
    .filter((d): d is SyncV2Decision => d !== null);
}
