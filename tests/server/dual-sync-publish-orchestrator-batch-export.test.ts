import { describe, expect, it, vi } from 'vitest';

import { runBatchExportPorts } from '@/server/dual-sync/publish/orchestrator-batch-export';
import { buildRegistry } from '@/server/dual-sync/registry';

import type { DualSyncOrchestratorPorts } from '@/server/dual-sync/publish/ports';
import type { DualSyncPublishDecision } from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function makeSnapshot(
  overrides: Partial<DualSyncCanonicalSnapshot> = {},
): DualSyncCanonicalSnapshot {
  return {
    profile: {
      name: 'Acme',
      businessDescription: 'Tasty',
      contactPhone: null,
      address: '1 Main',
      storefrontAddress: null,
      googleMapUrl: null,
      googleReviewUrl: null,
    },
    operatingHours: {
      weekly: [
        { dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00', isClosed: false },
        { dayOfWeek: 2, opensAt: '09:00', closesAt: '17:00', isClosed: false },
      ],
    },
    servicePeriods: { periods: [] },
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    ...overrides,
  };
}

function makeDecision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'operatingHours.weekly.1',
    sectionKey: 'operatingHours',
    action: 'export_to_google',
    pinnedCoreHash: 'core-hash',
    pinnedGbpHash: 'gbp-hash',
    ...overrides,
  };
}

function makeInput(
  overrides: {
    readonly ports?: Partial<DualSyncOrchestratorPorts>;
    readonly decisions?: ReadonlyArray<DualSyncPublishDecision>;
    readonly googleEditThrottle?: Parameters<typeof runBatchExportPorts>[0]['googleEditThrottle'];
  } = {},
): Parameters<typeof runBatchExportPorts>[0] {
  const coreSnapshot = makeSnapshot();
  const gbpSnapshot = makeSnapshot();
  return {
    ports: {
      applyImportToCore: vi.fn(),
      applyExportToGoogle: vi.fn(),
      ...overrides.ports,
    },
    decisions: overrides.decisions ?? [
      makeDecision(),
      makeDecision({ fieldKey: 'operatingHours.weekly.2' }),
    ],
    coreSnapshot,
    gbpSnapshot,
    registry: buildRegistry({ coreSnapshot, gbpSnapshot, includeCoreOnly: false }),
    client,
    publishJobId: 'job-1',
    restaurantId: 'rest-1',
    actorUserId: 'user-1',
    googleEditThrottle: overrides.googleEditThrottle,
  };
}

describe('runBatchExportPorts', () => {
  it('returns no prebuilt results when no batch port is configured', async () => {
    const input = makeInput();

    await expect(runBatchExportPorts(input)).resolves.toEqual(new Map());
  });

  it('short-circuits single-decision export groups', async () => {
    const applyExportBatchToGoogle = vi.fn();
    const input = makeInput({
      ports: { applyExportBatchToGoogle },
      decisions: [makeDecision()],
    });

    const result = await runBatchExportPorts(input);

    expect(result.size).toBe(0);
    expect(applyExportBatchToGoogle).not.toHaveBeenCalled();
  });

  it('maps supported batch results by field key', async () => {
    const applyExportBatchToGoogle = vi.fn().mockResolvedValue({
      supported: true,
      perField: {
        'operatingHours.weekly.1': { status: 'succeeded' },
        'operatingHours.weekly.2': { status: 'skipped' },
      },
    });
    const input = makeInput({ ports: { applyExportBatchToGoogle } });

    const result = await runBatchExportPorts(input);

    expect(applyExportBatchToGoogle).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        publishJobId: 'job-1',
        sectionKey: 'operatingHours',
        decisions: input.decisions,
        coreSnapshot: input.coreSnapshot,
        gbpSnapshot: input.gbpSnapshot,
        actorUserId: 'user-1',
      }),
    );
    expect(result.get('operatingHours.weekly.1')).toEqual({ status: 'succeeded' });
    expect(result.get('operatingHours.weekly.2')).toEqual({ status: 'skipped' });
  });

  it('returns no prebuilt result when the batch port opts out', async () => {
    const applyExportBatchToGoogle = vi.fn().mockResolvedValue({ supported: false });
    const input = makeInput({ ports: { applyExportBatchToGoogle } });

    const result = await runBatchExportPorts(input);

    expect(applyExportBatchToGoogle).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(0);
  });

  it('maps throttle failures to every decision in the batch', async () => {
    const applyExportBatchToGoogle = vi.fn();
    const reserve = vi.fn().mockResolvedValue({
      allowed: false,
      retryAfterMs: 90000,
      remaining: 0,
    });
    const input = makeInput({
      ports: { applyExportBatchToGoogle },
      googleEditThrottle: { reserve },
    });

    const result = await runBatchExportPorts(input);

    expect(reserve).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      writeGroup: 'operatingHours',
    });
    expect(applyExportBatchToGoogle).not.toHaveBeenCalled();
    expect(result.get('operatingHours.weekly.1')?.failure).toMatchObject({
      code: 'QUOTA_LIMITED',
      retryable: true,
    });
    expect(result.get('operatingHours.weekly.2')?.failure).toMatchObject({
      code: 'QUOTA_LIMITED',
      retryable: true,
    });
  });

  it('maps thrown batch port errors to every decision in the batch', async () => {
    const applyExportBatchToGoogle = vi.fn().mockRejectedValue(new Error('upstream broke'));
    const input = makeInput({ ports: { applyExportBatchToGoogle } });

    const result = await runBatchExportPorts(input);

    expect(result.get('operatingHours.weekly.1')?.failure).toMatchObject({
      code: 'EXTERNAL_API_ERROR',
      message: 'upstream broke',
    });
    expect(result.get('operatingHours.weekly.2')?.failure).toMatchObject({
      code: 'EXTERNAL_API_ERROR',
      message: 'upstream broke',
    });
  });

  it('marks missing per-field batch results as port failures', async () => {
    const applyExportBatchToGoogle = vi.fn().mockResolvedValue({
      supported: true,
      perField: {
        'operatingHours.weekly.1': { status: 'succeeded' },
      },
    });
    const input = makeInput({ ports: { applyExportBatchToGoogle } });

    const result = await runBatchExportPorts(input);

    expect(result.get('operatingHours.weekly.1')).toEqual({ status: 'succeeded' });
    expect(result.get('operatingHours.weekly.2')?.failure).toEqual({
      code: 'PORT_FAILURE',
      message: 'Batch export did not return a result for operatingHours.weekly.2.',
      retryable: false,
    });
  });
});
