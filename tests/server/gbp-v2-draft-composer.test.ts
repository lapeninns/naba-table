import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDraftMock = vi.hoisted(() => vi.fn());
const ensureWorkflowMock = vi.hoisted(() => vi.fn());
const getActiveDraftForWorkflowMock = vi.hoisted(() => vi.fn());
const setDraftStatusMock = vi.hoisted(() => vi.fn());
const readGoogleSnapshotMock = vi.hoisted(() => vi.fn());
const readNabatableSnapshotMock = vi.hoisted(() => vi.fn());
const buildSyncV2DiffMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile-v2/drafts/store', () => ({
  createDraft: createDraftMock,
  ensureWorkflow: ensureWorkflowMock,
  getActiveDraftForWorkflow: getActiveDraftForWorkflowMock,
  setDraftStatus: setDraftStatusMock,
}));

vi.mock('@/server/google-business-profile-v2/snapshot/google', () => ({
  readGoogleSnapshot: readGoogleSnapshotMock,
}));

vi.mock('@/server/google-business-profile-v2/snapshot/nabatable', () => ({
  readNabatableSnapshot: readNabatableSnapshotMock,
}));

vi.mock('@/server/google-business-profile-v2/diff/engine', () => ({
  buildSyncV2Diff: buildSyncV2DiffMock,
}));

import { composeDraft } from '@/server/google-business-profile-v2/drafts/composer';

import type { SyncV2Draft, SyncV2Workflow } from '@/server/google-business-profile-v2/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = '2026-04-29T11:15:29.877Z';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

const workflow: SyncV2Workflow = {
  id: 'workflow-1',
  restaurantId: 'restaurant-1',
  provider: 'google_business_profile',
  activeDraftId: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const draft: SyncV2Draft = {
  id: 'draft-1',
  workflowId: 'workflow-1',
  restaurantId: 'restaurant-1',
  status: 'open',
  nabatableSnapshot: { sections: [], hash: 'nab-hash', fetchedAt: NOW },
  googleSnapshot: { sections: [], hash: 'google-hash', fetchedAt: NOW },
  diffItems: [],
  fetchedAt: NOW,
  createdByUserId: 'user-1',
  createdAt: NOW,
  updatedAt: NOW,
};

describe('composeDraft', () => {
  beforeEach(() => {
    createDraftMock.mockReset();
    ensureWorkflowMock.mockReset();
    getActiveDraftForWorkflowMock.mockReset();
    setDraftStatusMock.mockReset();
    readGoogleSnapshotMock.mockReset();
    readNabatableSnapshotMock.mockReset();
    buildSyncV2DiffMock.mockReset();
  });

  it('returns an active draft before reading fresh snapshots', async () => {
    ensureWorkflowMock.mockResolvedValue(workflow);
    getActiveDraftForWorkflowMock.mockResolvedValue(draft);

    const result = await composeDraft({
      client,
      restaurantId: 'restaurant-1',
      createdByUserId: 'user-1',
    });

    expect(result).toBe(draft);
    expect(getActiveDraftForWorkflowMock).toHaveBeenCalledWith({
      client,
      workflowId: 'workflow-1',
    });
    expect(readNabatableSnapshotMock).not.toHaveBeenCalled();
    expect(readGoogleSnapshotMock).not.toHaveBeenCalled();
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('archives an open active draft before composing a refresh', async () => {
    const nabatable = {
      canonical: { profile: {} },
      snapshot: draft.nabatableSnapshot,
    };
    const google = {
      canonical: { profile: {} },
      snapshot: draft.googleSnapshot,
    };
    const refreshedDraft = { ...draft, id: 'draft-2' };
    ensureWorkflowMock.mockResolvedValue(workflow);
    getActiveDraftForWorkflowMock.mockResolvedValue(draft);
    setDraftStatusMock.mockResolvedValue(undefined);
    readNabatableSnapshotMock.mockResolvedValue(nabatable);
    readGoogleSnapshotMock.mockResolvedValue(google);
    buildSyncV2DiffMock.mockReturnValue({ items: [] });
    createDraftMock.mockResolvedValue(refreshedDraft);

    const result = await composeDraft({
      client,
      restaurantId: 'restaurant-1',
      createdByUserId: 'user-1',
      refresh: true,
    });

    expect(result).toBe(refreshedDraft);
    expect(setDraftStatusMock).toHaveBeenCalledWith({
      client,
      draftId: 'draft-1',
      status: 'archived',
    });
    expect(readNabatableSnapshotMock).toHaveBeenCalled();
    expect(readGoogleSnapshotMock).toHaveBeenCalled();
    expect(createDraftMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'restaurant-1',
      workflowId: 'workflow-1',
      nabatableSnapshot: draft.nabatableSnapshot,
      googleSnapshot: draft.googleSnapshot,
      diffItems: [],
      createdByUserId: 'user-1',
    });
  });

  it('rejects refreshes for locked active drafts', async () => {
    ensureWorkflowMock.mockResolvedValue(workflow);
    getActiveDraftForWorkflowMock.mockResolvedValue({ ...draft, status: 'preflight_locked' });

    await expect(
      composeDraft({
        client,
        restaurantId: 'restaurant-1',
        createdByUserId: 'user-1',
        refresh: true,
      }),
    ).rejects.toThrow('already in progress');

    expect(setDraftStatusMock).not.toHaveBeenCalled();
    expect(readNabatableSnapshotMock).not.toHaveBeenCalled();
    expect(readGoogleSnapshotMock).not.toHaveBeenCalled();
    expect(createDraftMock).not.toHaveBeenCalled();
  });

  it('creates a fresh draft when no active draft exists', async () => {
    const nabatable = {
      canonical: { profile: {} },
      snapshot: draft.nabatableSnapshot,
    };
    const google = {
      canonical: { profile: {} },
      snapshot: draft.googleSnapshot,
    };
    ensureWorkflowMock.mockResolvedValue(workflow);
    getActiveDraftForWorkflowMock.mockResolvedValue(null);
    readNabatableSnapshotMock.mockResolvedValue(nabatable);
    readGoogleSnapshotMock.mockResolvedValue(google);
    buildSyncV2DiffMock.mockReturnValue({ items: [] });
    createDraftMock.mockResolvedValue(draft);

    const result = await composeDraft({
      client,
      restaurantId: 'restaurant-1',
      createdByUserId: 'user-1',
    });

    expect(result).toBe(draft);
    expect(buildSyncV2DiffMock).toHaveBeenCalledWith({
      nabatable: nabatable.canonical,
      google: google.canonical,
    });
    expect(createDraftMock).toHaveBeenCalledWith({
      client,
      restaurantId: 'restaurant-1',
      workflowId: 'workflow-1',
      nabatableSnapshot: draft.nabatableSnapshot,
      googleSnapshot: draft.googleSnapshot,
      diffItems: [],
      createdByUserId: 'user-1',
    });
  });
});
