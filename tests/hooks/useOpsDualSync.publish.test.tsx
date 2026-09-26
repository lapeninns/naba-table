import { act, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { queryKeys } from '@/lib/query/keys';
import { publishDualSyncDecisions, publishGbpExactV1 } from '@/services/ops/dual-sync';

import type {
  DualSyncPublishRequest,
  DualSyncPublishResponse,
  GbpExactPublishRequestV1,
  GbpPublishResponseV1,
} from '@/services/ops/dual-sync';

vi.mock('@/services/ops/dual-sync', () => ({
  getDualSyncMetrics: vi.fn(),
  getDualSyncPublishJobDetail: vi.fn(),
  getDualSyncState: vi.fn(),
  listDualSyncCandidates: vi.fn(),
  listDualSyncJobs: vi.fn(),
  listDualSyncOperations: vi.fn(),
  listDualSyncPublishJobs: vi.fn(),
  previewDualSyncPublishPlan: vi.fn(),
  previewGbpExactPublishV1: vi.fn(),
  publishDualSyncDecisions: vi.fn(),
  publishGbpExactV1: vi.fn(),
  refreshDualSync: vi.fn(),
  cancelDualSyncCandidate: vi.fn(),
  retryDualSyncJob: vi.fn(),
  runDualSyncAutoExport: vi.fn(),
  setDualSyncControl: vi.fn(),
}));

const restaurantId = 'restaurant-1';

type Decision = DualSyncPublishRequest['decisions'][number];

function decision(fieldKey: string, sectionKey: Decision['sectionKey']): Decision {
  return {
    fieldKey,
    sectionKey,
    action: 'import_from_google',
    pinnedCoreHash: 'core',
    pinnedGbpHash: 'gbp',
  };
}

function summary(failedFieldKeys: string[] = []): DualSyncPublishResponse {
  return {
    publishJobId: 'job-1',
    restaurantId,
    totalDecisions: 1,
    succeededCount: 0,
    failedCount: failedFieldKeys.length,
    skippedCount: 0,
    operations: [],
    failures: failedFieldKeys.map((fieldKey) => ({
      fieldKey,
      failure: { code: 'PORT_FAILURE', message: 'x', retryable: false },
    })),
  } as unknown as DualSyncPublishResponse;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const hook = renderHook(
    () => ({
      a: useOpsDualSync({ restaurantId, stateEnabled: false }),
      b: useOpsDualSync({ restaurantId, stateEnabled: false }),
    }),
    { wrapper: createQueryWrapper(queryClient) },
  );
  const invalidated = () =>
    invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
  return { queryClient, invalidated, ...hook };
}

const key = (value: readonly unknown[]) => JSON.stringify(value);

describe('useOpsDualSync publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@contract refreshes the Nabatable data a successful Google import changed', async () => {
    vi.mocked(publishDualSyncDecisions).mockResolvedValue(summary());
    const { result, invalidated } = setup();

    await act(async () => {
      await result.current.a.publishMutation.mutateAsync({
        clientRequestId: 'intent-1',
        decisions: [decision('profile.googleMapUrl', 'profile')],
      });
    });

    expect(invalidated()).toEqual(
      expect.arrayContaining([
        key(queryKeys.opsRestaurants.detail(restaurantId)),
        key(queryKeys.opsRestaurants.businessContext(restaurantId)),
        // The restaurant switcher and shell show the profile name from the list cache.
        key(queryKeys.opsRestaurants.list()),
      ]),
    );
    expect(invalidated()).not.toContain(key(queryKeys.opsRestaurants.hours(restaurantId)));
    expect(invalidated()).not.toContain(key(queryKeys.opsMenuHierarchy.list(restaurantId)));
  });

  it('@contract maps each imported section to its Nabatable cache', async () => {
    vi.mocked(publishDualSyncDecisions).mockResolvedValue(summary());
    const { result, invalidated } = setup();

    await act(async () => {
      await result.current.a.publishMutation.mutateAsync({
        decisions: [
          decision('operatingHours.weekly.mon', 'operatingHours'),
          decision('servicePeriods.lunch', 'servicePeriods'),
          decision('foodMenus.items.1', 'foodMenus'),
          decision('businessContext.categories.primary', 'businessContext.categories'),
        ],
      });
    });

    expect(invalidated()).toEqual(
      expect.arrayContaining([
        key(queryKeys.opsRestaurants.hours(restaurantId)),
        key(queryKeys.opsRestaurants.servicePeriods(restaurantId)),
        key(queryKeys.opsMenuHierarchy.list(restaurantId)),
        key(queryKeys.opsRestaurants.businessContext(restaurantId)),
      ]),
    );
  });

  it('@contract leaves Nabatable caches alone when every import failed', async () => {
    vi.mocked(publishDualSyncDecisions).mockResolvedValue(summary(['profile.name']));
    const { result, invalidated } = setup();

    await act(async () => {
      await result.current.a.publishMutation.mutateAsync({
        decisions: [decision('profile.name', 'profile')],
      });
    });

    expect(invalidated()).not.toContain(
      key(queryKeys.opsRestaurants.businessContext(restaurantId)),
    );
  });

  it('@contract treats a failed stored operation as a failure even when failures is empty (replay)', async () => {
    const replay = {
      ...summary(),
      failedCount: 1,
      operations: [{ fieldKey: 'profile.name', status: 'failed' }],
    } as unknown as DualSyncPublishResponse;
    vi.mocked(publishDualSyncDecisions).mockResolvedValue(replay);
    const { result, invalidated } = setup();

    await act(async () => {
      await result.current.a.publishMutation.mutateAsync({
        clientRequestId: 'intent-1',
        decisions: [decision('profile.name', 'profile')],
      });
    });

    expect(invalidated()).not.toContain(
      key(queryKeys.opsRestaurants.businessContext(restaurantId)),
    );
  });

  it('@contract serializes publishes from two surfaces and shows the pending state on both', async () => {
    const first = deferred<DualSyncPublishResponse>();
    vi.mocked(publishDualSyncDecisions)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(summary());
    const { result } = setup();

    let firstDone: Promise<unknown> = Promise.resolve();
    let secondDone: Promise<unknown> = Promise.resolve();
    act(() => {
      firstDone = result.current.a.publishMutation.mutateAsync({
        decisions: [decision('profile.name', 'profile')],
      });
    });
    await waitFor(() => expect(result.current.b.isPublishPending).toBe(true));
    act(() => {
      secondDone = result.current.b.publishMutation.mutateAsync({
        decisions: [decision('profile.contactPhone', 'profile')],
      });
    });

    // The second publish waits in the restaurant scope until the first settles.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(publishDualSyncDecisions).toHaveBeenCalledTimes(1);
    expect(result.current.a.isPublishPending).toBe(true);

    await act(async () => {
      first.resolve(summary());
      await firstDone;
      await secondDone;
    });
    expect(publishDualSyncDecisions).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.a.isPublishPending).toBe(false));
  });

  it('@contract an exact publish that imports from Google refreshes Nabatable caches too', async () => {
    vi.mocked(publishGbpExactV1).mockResolvedValue({
      mode: 'queued',
      bundleId: 'b',
      grantIds: ['g'],
      jobId: 'j',
      status: 'queued',
    } as unknown as GbpPublishResponseV1);
    const { result, invalidated } = setup();

    await act(async () => {
      await result.current.a.exactPublishMutation.mutateAsync({
        decisions: [decision('profile.name', 'profile')],
      } as unknown as GbpExactPublishRequestV1);
    });

    expect(invalidated()).toContain(key(queryKeys.opsRestaurants.businessContext(restaurantId)));
  });

  it('an exact publish that only exports to Google does not touch Nabatable caches', async () => {
    vi.mocked(publishGbpExactV1).mockResolvedValue({
      mode: 'queued',
    } as unknown as GbpPublishResponseV1);
    const { result, invalidated } = setup();

    await act(async () => {
      await result.current.a.exactPublishMutation.mutateAsync({
        decisions: [{ ...decision('profile.name', 'profile'), action: 'export_to_google' }],
      } as unknown as GbpExactPublishRequestV1);
    });

    expect(invalidated()).not.toContain(
      key(queryKeys.opsRestaurants.businessContext(restaurantId)),
    );
  });
});
