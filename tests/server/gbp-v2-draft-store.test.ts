import { describe, expect, it, vi } from 'vitest';

import { createDraft } from '@/server/google-business-profile-v2/drafts/store';

import type { SyncV2DraftRow } from '@/server/google-business-profile-v2/db';
import type { SyncV2Snapshot } from '@/server/google-business-profile-v2/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = '2026-04-29T11:15:29.877Z';

const snapshot: SyncV2Snapshot = {
  sections: [],
  hash: 'snapshot-hash',
  fetchedAt: NOW,
};

function draftRow(overrides: Partial<SyncV2DraftRow> = {}): SyncV2DraftRow {
  return {
    id: 'draft-1',
    workflow_id: 'workflow-1',
    restaurant_id: 'restaurant-1',
    status: 'open',
    nabatable_snapshot: snapshot,
    google_snapshot: snapshot,
    nabatable_snapshot_hash: snapshot.hash,
    google_snapshot_hash: snapshot.hash,
    diff_items: [],
    fetched_at: NOW,
    created_by_user_id: 'user-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function createClientMock({
  activeDraftResults,
  insertDraftResult,
}: {
  activeDraftResults: Array<{ data: SyncV2DraftRow | null; error: null | { message: string } }>;
  insertDraftResult: {
    data: SyncV2DraftRow | null;
    error: null | { code?: string; message: string };
  };
}) {
  const maybeSingle = vi.fn(async () => activeDraftResults.shift() ?? { data: null, error: null });
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const inFilter = vi.fn(() => ({ order }));
  const eq = vi.fn(() => ({ in: inFilter }));
  const select = vi.fn(() => ({ eq }));
  const insertSingle = vi.fn(async () => insertDraftResult);
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: insertSelect }));
  const updateEq = vi.fn(() => ({ error: null }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn((table: string) => {
    if (table === 'gbp_sync_v2_drafts') {
      return { select, insert };
    }
    if (table === 'gbp_sync_v2_workflows') {
      return { update };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    spies: { from, insert, insertSingle, maybeSingle, update },
  };
}

const createDraftInput = {
  restaurantId: 'restaurant-1',
  workflowId: 'workflow-1',
  nabatableSnapshot: snapshot,
  googleSnapshot: snapshot,
  diffItems: [],
  createdByUserId: 'user-1',
};

describe('GBP sync V2 draft store', () => {
  it('returns the active draft instead of inserting another open draft', async () => {
    const activeDraft = draftRow({ id: 'active-draft' });
    const { client, spies } = createClientMock({
      activeDraftResults: [{ data: activeDraft, error: null }],
      insertDraftResult: { data: null, error: null },
    });

    const draft = await createDraft({ client, ...createDraftInput });

    expect(draft.id).toBe('active-draft');
    expect(spies.insert).not.toHaveBeenCalled();
    expect(spies.update).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent active-draft unique violation by returning the active draft', async () => {
    const activeDraft = draftRow({ id: 'active-after-race' });
    const { client, spies } = createClientMock({
      activeDraftResults: [
        { data: null, error: null },
        { data: activeDraft, error: null },
      ],
      insertDraftResult: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "gbp_sync_v2_drafts_one_open_per_workflow_idx"',
        },
      },
    });

    const draft = await createDraft({ client, ...createDraftInput });

    expect(draft.id).toBe('active-after-race');
    expect(spies.insert).toHaveBeenCalledTimes(1);
    expect(spies.update).not.toHaveBeenCalled();
  });
});
