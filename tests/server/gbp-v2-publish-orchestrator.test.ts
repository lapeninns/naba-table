import { beforeEach, describe, expect, it, vi } from 'vitest';

const writePublishEventMock = vi.hoisted(() => vi.fn());
const setDraftStatusMock = vi.hoisted(() => vi.fn());
const getPublishJobMock = vi.hoisted(() => vi.fn());
const setPublishJobStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile-v2/publish/audit', () => ({
  writePublishEvent: writePublishEventMock,
}));

vi.mock('@/server/google-business-profile-v2/drafts/store', () => ({
  setDraftStatus: setDraftStatusMock,
}));

vi.mock('@/server/google-business-profile-v2/preflight/store', () => ({
  getPublishJob: getPublishJobMock,
  setPublishJobStatus: setPublishJobStatusMock,
}));

import { executePublish } from '@/server/google-business-profile-v2/publish/orchestrator';

import type { OrchestratorPorts } from '@/server/google-business-profile-v2/publish/ports';
import type { SyncV2PublishJob } from '@/server/google-business-profile-v2/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const NOW = '2026-04-29T12:10:00.000Z';
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

const job: SyncV2PublishJob = {
  id: 'job-1',
  workflowId: 'workflow-1',
  draftId: 'draft-1',
  restaurantId: 'restaurant-1',
  directionIntent: 'import_to_nabatable',
  publishPlanId: 'plan-1',
  idempotencyKey: 'idem-1',
  frozenDecisions: [],
  frozenDecisionsHash: 'frozen-hash',
  frozenNabatableSnapshotHash: 'nab-hash',
  frozenGoogleSnapshotHash: 'google-hash',
  preflightResult: null,
  googleUpdateMasks: [],
  status: 'preflight_locked',
  errorClassification: null,
  errors: [],
  nabatableEventId: null,
  googleEventId: null,
  rollbackEventId: null,
  preflightedAt: NOW,
  publishedAt: null,
  failedAt: null,
  retriedAt: null,
  createdByUserId: 'user-1',
  publishedByUserId: null,
  retriedByUserId: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function ports(overrides: Partial<OrchestratorPorts> = {}): OrchestratorPorts {
  return {
    directionIntentSupported: () => true,
    verifyContractLock: vi.fn().mockResolvedValue([]),
    applyToNabatable: vi.fn().mockResolvedValue({
      ok: true,
      output: {
        affectedSectionKeys: ['businessContext.categories'],
        googleUpdateMasks: [],
        oldValues: {},
        newValues: {},
      },
    }),
    patchGoogle: vi.fn(),
    ...overrides,
  };
}

describe('executePublish', () => {
  beforeEach(() => {
    writePublishEventMock.mockReset();
    setDraftStatusMock.mockReset();
    getPublishJobMock.mockReset();
    setPublishJobStatusMock.mockReset();
  });

  it('marks the draft published when an import publish succeeds', async () => {
    getPublishJobMock.mockResolvedValue(job);
    writePublishEventMock.mockResolvedValue('event-1');

    const result = await executePublish({
      client,
      jobId: 'job-1',
      actorUserId: 'user-1',
      ports: ports(),
    });

    expect(result.errors).toEqual([]);
    expect(setPublishJobStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        jobId: 'job-1',
        status: 'published',
      }),
    );
    expect(setDraftStatusMock).toHaveBeenCalledWith({
      client,
      draftId: 'draft-1',
      status: 'published',
    });
  });

  it('marks the draft failed when contract lock verification fails', async () => {
    getPublishJobMock.mockResolvedValue(job);
    const lockErrors = [
      {
        code: 'V2_NABATABLE_SNAPSHOT_DRIFT',
        message: 'Nabatable snapshot changed since preflight; re-review and re-preflight.',
      },
    ];

    const result = await executePublish({
      client,
      jobId: 'job-1',
      actorUserId: 'user-1',
      ports: ports({
        verifyContractLock: vi.fn().mockResolvedValue(lockErrors),
      }),
    });

    expect(result.errors).toEqual(lockErrors);
    expect(setPublishJobStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        jobId: 'job-1',
        status: 'failed',
      }),
    );
    expect(setDraftStatusMock).toHaveBeenCalledWith({
      client,
      draftId: 'draft-1',
      status: 'failed',
    });
  });
});
