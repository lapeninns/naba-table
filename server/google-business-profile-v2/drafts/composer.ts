/**
 * Phase 3 of the GBP Dual-Sync V2 architecture.
 *
 * Draft composer. Reads both side snapshots, runs the diff engine, and
 * persists a fresh `gbp_sync_v2_drafts` row. Returns the typed draft for
 * downstream callers.
 */

import { createDraft, ensureWorkflow, getActiveDraftForWorkflow, setDraftStatus } from './store';
import { buildSyncV2Diff } from '../diff/engine';
import { readGoogleSnapshot } from '../snapshot/google';
import { readNabatableSnapshot } from '../snapshot/nabatable';

import type { SyncV2Draft } from '../types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ComposeDraftInput {
  readonly client: SupabaseClient<Database>;
  readonly restaurantId: string;
  readonly createdByUserId: string | null;
  readonly refresh?: boolean;
}

export class SyncV2DraftRefreshConflictError extends Error {
  constructor(message = 'This V2 draft is already in progress and cannot be refreshed.') {
    super(message);
    this.name = 'GBP_SYNC_V2_DRAFT_REFRESH_CONFLICT';
  }
}

export async function composeDraft({
  client,
  restaurantId,
  createdByUserId,
  refresh = false,
}: ComposeDraftInput): Promise<SyncV2Draft> {
  const workflow = await ensureWorkflow({ client, restaurantId });
  const activeDraft = await getActiveDraftForWorkflow({ client, workflowId: workflow.id });
  if (activeDraft && !refresh) return activeDraft;
  if (activeDraft && refresh) {
    if (activeDraft.status !== 'open') {
      throw new SyncV2DraftRefreshConflictError();
    }
    await setDraftStatus({ client, draftId: activeDraft.id, status: 'archived' });
  }

  const [nab, goo] = await Promise.all([
    readNabatableSnapshot({ client, restaurantId }),
    readGoogleSnapshot({ client, restaurantId }),
  ]);
  const { items } = buildSyncV2Diff({
    nabatable: nab.canonical,
    google: goo.canonical,
  });
  return createDraft({
    client,
    restaurantId,
    workflowId: workflow.id,
    nabatableSnapshot: nab.snapshot,
    googleSnapshot: goo.snapshot,
    diffItems: items,
    createdByUserId,
  });
}
