/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Draft + workflow store. Each restaurant has at most one V2 workflow row.
 * A workflow can have at most one draft in `open`/`preflight_locked`/`publishing`
 * status (enforced by the partial unique index on `gbp_sync_v2_drafts`).
 */

import { getSyncV2DbClient, type SyncV2DraftRow, type SyncV2WorkflowRow } from '../db';
import { hashCanonicalJson } from '../hashing';

import type { SyncV2Draft, SyncV2DraftStatus, SyncV2Snapshot, SyncV2Workflow } from '../types';
import type { Json } from '@/types/supabase';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const ACTIVE_DRAFT_STATUSES = ['open', 'preflight_locked', 'publishing'] as const;
const UNIQUE_VIOLATION_CODE = '23505';

export interface DraftStoreContext {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

function workflowRowToWorkflow(row: SyncV2WorkflowRow): SyncV2Workflow {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    provider: 'google_business_profile',
    activeDraftId: row.active_draft_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function draftRowToDraft(row: SyncV2DraftRow): SyncV2Draft {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    restaurantId: row.restaurant_id,
    status: row.status,
    nabatableSnapshot: row.nabatable_snapshot as unknown as SyncV2Snapshot,
    googleSnapshot: row.google_snapshot as unknown as SyncV2Snapshot,
    diffItems: (Array.isArray(row.diff_items)
      ? row.diff_items
      : []) as unknown as SyncV2Draft['diffItems'],
    fetchedAt: row.fetched_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureWorkflow({
  client,
  restaurantId,
}: DraftStoreContext): Promise<SyncV2Workflow> {
  const v2 = getSyncV2DbClient(client);
  const { data: existing, error: selectErr } = await v2
    .from('gbp_sync_v2_workflows')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'google_business_profile')
    .maybeSingle();
  if (selectErr) {
    throw new Error(`Failed to read V2 workflow for ${restaurantId}: ${selectErr.message}`);
  }
  if (existing) return workflowRowToWorkflow(existing);
  const { data: inserted, error: insertErr } = await v2
    .from('gbp_sync_v2_workflows')
    .insert({ restaurant_id: restaurantId } as never)
    .select('*')
    .single();
  if (insertErr || !inserted) {
    throw new Error(
      `Failed to create V2 workflow for ${restaurantId}: ${insertErr?.message ?? 'no row returned'}`,
    );
  }
  return workflowRowToWorkflow(inserted);
}

export async function getActiveDraftForWorkflow({
  client,
  workflowId,
}: {
  readonly client: SupabaseClient<Database>;
  readonly workflowId: string;
}): Promise<SyncV2Draft | null> {
  const v2 = getSyncV2DbClient(client);
  const { data, error } = await v2
    .from('gbp_sync_v2_drafts')
    .select('*')
    .eq('workflow_id', workflowId)
    .in('status', [...ACTIVE_DRAFT_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to read active V2 draft for workflow ${workflowId}: ${error.message}`);
  }
  return data ? draftRowToDraft(data) : null;
}

export interface CreateDraftInput {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly workflowId: string;
  readonly nabatableSnapshot: SyncV2Snapshot;
  readonly googleSnapshot: SyncV2Snapshot;
  readonly diffItems: SyncV2Draft['diffItems'];
  readonly createdByUserId: string | null;
}

export async function createDraft({
  client,
  restaurantId,
  workflowId,
  nabatableSnapshot,
  googleSnapshot,
  diffItems,
  createdByUserId,
}: CreateDraftInput): Promise<SyncV2Draft> {
  const v2 = getSyncV2DbClient(client);
  const existingActiveDraft = await getActiveDraftForWorkflow({ client, workflowId });
  if (existingActiveDraft) {
    return existingActiveDraft;
  }

  const insert: Partial<SyncV2DraftRow> = {
    workflow_id: workflowId,
    restaurant_id: restaurantId,
    status: 'open',
    nabatable_snapshot: nabatableSnapshot as unknown as Json,
    google_snapshot: googleSnapshot as unknown as Json,
    nabatable_snapshot_hash: nabatableSnapshot.hash,
    google_snapshot_hash: googleSnapshot.hash,
    diff_items: diffItems as unknown as Json,
    fetched_at: new Date().toISOString(),
    created_by_user_id: createdByUserId,
  };
  const { data, error } = await v2
    .from('gbp_sync_v2_drafts')
    .insert(insert as never)
    .select('*')
    .single();
  if (error || !data) {
    if (isUniqueViolation(error)) {
      const activeDraft = await getActiveDraftForWorkflow({ client, workflowId });
      if (activeDraft) return activeDraft;
    }

    throw new Error(
      `Failed to create V2 draft for restaurant ${restaurantId}: ${error?.message ?? 'no row returned'}`,
    );
  }
  const draftRow = data as unknown as SyncV2DraftRow;
  // Update workflow.active_draft_id pointer.
  await v2
    .from('gbp_sync_v2_workflows')
    .update({ active_draft_id: draftRow.id } as never)
    .eq('id', workflowId);
  return draftRowToDraft(draftRow);
}

export async function getDraft({
  client,
  restaurantId,
  draftId,
}: DraftStoreContext & { readonly draftId: string }): Promise<SyncV2Draft | null> {
  const v2 = getSyncV2DbClient(client);
  const { data, error } = await v2
    .from('gbp_sync_v2_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to read V2 draft ${draftId}: ${error.message}`);
  }
  return data ? draftRowToDraft(data) : null;
}

export async function setDraftStatus({
  client,
  draftId,
  status,
}: {
  readonly client: SupabaseClient<Database>;
  readonly draftId: string;
  readonly status: SyncV2DraftStatus;
}): Promise<void> {
  const v2 = getSyncV2DbClient(client);
  const { error } = await v2
    .from('gbp_sync_v2_drafts')
    .update({ status } as never)
    .eq('id', draftId);
  if (error) {
    throw new Error(`Failed to update V2 draft ${draftId} status: ${error.message}`);
  }
}

/** Helper: hash two snapshots together as a stable draft fingerprint. */
export function fingerprintDraft(nabatable: SyncV2Snapshot, google: SyncV2Snapshot): string {
  return hashCanonicalJson({ n: nabatable.hash, g: google.hash });
}
