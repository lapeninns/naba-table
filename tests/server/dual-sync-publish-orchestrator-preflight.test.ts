import { describe, expect, it, vi, beforeEach } from 'vitest';

const updateOperationGroupStatusMock = vi.hoisted(() => vi.fn());
const createGoogleRequestLogMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/publish/operations', () => ({
  updateOperationGroupStatus: updateOperationGroupStatusMock,
}));

vi.mock('@/server/dual-sync/publish/google-request-logs', () => ({
  createGoogleRequestLog: createGoogleRequestLogMock,
}));

import { runRequiredExportPreflights } from '@/server/dual-sync/publish/orchestrator-preflight';

import type { DualSyncExportPreflightPort } from '@/server/dual-sync/publish/preflight';
import type {
  DualSyncPublishDecision,
  DualSyncPublishGroup,
} from '@/server/dual-sync/publish/types';
import type { DualSyncCanonicalSnapshot } from '@/server/dual-sync/snapshots/types';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;
const snapshot = {} as DualSyncCanonicalSnapshot;

function decision(overrides: Partial<DualSyncPublishDecision> = {}): DualSyncPublishDecision {
  return {
    fieldKey: 'operatingHours.weekly.1',
    sectionKey: 'operatingHours',
    action: 'export_to_google',
    pinnedCoreHash: 'core-hash',
    pinnedGbpHash: 'gbp-hash',
    ...overrides,
  };
}

function group(overrides: Partial<DualSyncPublishGroup> = {}): DualSyncPublishGroup {
  return {
    groupId: 'export_to_google:operatingHours:location.regularHours',
    direction: 'export_to_google',
    sectionKey: 'operatingHours',
    writeGroup: 'location.regularHours',
    fields: [decision(), decision({ fieldKey: 'operatingHours.weekly.2' })],
    riskLevel: 'high',
    requiresPreflight: true,
    requiresManualConfirmation: true,
    destructiveWritePossible: true,
    googleUpdateMasks: ['regularHours'],
    ...overrides,
  };
}

function input(
  overrides: {
    readonly planGroups?: ReadonlyArray<DualSyncPublishGroup>;
    readonly operationGroupIdByKey?: ReadonlyMap<string, string>;
    readonly exportPreflight?: DualSyncExportPreflightPort;
  } = {},
): Parameters<typeof runRequiredExportPreflights>[0] {
  const planGroups = overrides.planGroups ?? [group()];
  return {
    client,
    restaurantId: 'rest-1',
    publishBatchId: 'batch-1',
    actorUserId: 'user-1',
    planGroups,
    operationGroupIdByKey:
      overrides.operationGroupIdByKey ??
      new Map(planGroups.map((item) => [item.groupId, 'group-1'] as const)),
    coreSnapshot: snapshot,
    gbpSnapshot: snapshot,
    exportPreflight:
      overrides.exportPreflight ??
      vi.fn().mockResolvedValue({ status: 'passed', result: { validateOnly: true } }),
  };
}

describe('runRequiredExportPreflights', () => {
  beforeEach(() => {
    updateOperationGroupStatusMock.mockReset();
    updateOperationGroupStatusMock.mockResolvedValue(null);
    createGoogleRequestLogMock.mockReset();
    createGoogleRequestLogMock.mockResolvedValue(null);
  });

  it('skips non-required or non-export groups', async () => {
    const exportPreflight = vi.fn();
    const result = await runRequiredExportPreflights(
      input({
        planGroups: [
          group({ requiresPreflight: false }),
          group({
            groupId: 'import_from_google:operatingHours:core.operatingHours',
            direction: 'import_from_google',
            writeGroup: 'core.operatingHours',
          }),
        ],
        exportPreflight,
      }),
    );

    expect(result.size).toBe(0);
    expect(exportPreflight).not.toHaveBeenCalled();
    expect(updateOperationGroupStatusMock).not.toHaveBeenCalled();
    expect(createGoogleRequestLogMock).not.toHaveBeenCalled();
  });

  it('marks a passing preflight as pending again and records an audit log', async () => {
    const exportPreflight = vi.fn().mockResolvedValue({
      status: 'passed',
      result: { validateOnly: true },
    });

    const result = await runRequiredExportPreflights(input({ exportPreflight }));

    expect(result.size).toBe(0);
    expect(exportPreflight).toHaveBeenCalledWith(
      expect.objectContaining({
        client,
        restaurantId: 'rest-1',
        publishBatchId: 'batch-1',
        group: expect.objectContaining({
          groupId: 'export_to_google:operatingHours:location.regularHours',
        }),
        coreSnapshot: snapshot,
        gbpSnapshot: snapshot,
        actorUserId: 'user-1',
      }),
    );
    expect(updateOperationGroupStatusMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        operationGroupId: 'group-1',
        status: 'running',
        preflightStatus: 'running',
        requestSummary: expect.objectContaining({
          fieldKeys: ['operatingHours.weekly.1', 'operatingHours.weekly.2'],
        }),
      }),
    );
    expect(updateOperationGroupStatusMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        operationGroupId: 'group-1',
        status: 'pending',
        preflightStatus: 'passed',
        preflightResult: { validateOnly: true },
        responseSummary: { validateOnly: true },
      }),
    );
    expect(createGoogleRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationGroupId: 'group-1',
        phase: 'preflight',
        status: 'passed',
        googleMethod: 'location.regularHours',
        googleUpdateMasks: ['regularHours'],
        errorCode: null,
      }),
    );
  });

  it('fans out failed preflight results to every field in the group', async () => {
    const exportPreflight = vi.fn().mockResolvedValue({
      status: 'failed',
      failure: {
        code: 'GOOGLE_VALIDATION_FAILED',
        message: 'Google rejected the regular hours payload.',
        retryable: false,
      },
      result: { validateOnly: false },
    });

    const result = await runRequiredExportPreflights(input({ exportPreflight }));

    expect(result.get('operatingHours.weekly.1')).toMatchObject({
      code: 'GOOGLE_VALIDATION_FAILED',
      message: 'Google rejected the regular hours payload.',
    });
    expect(result.get('operatingHours.weekly.2')).toMatchObject({
      code: 'GOOGLE_VALIDATION_FAILED',
      message: 'Google rejected the regular hours payload.',
    });
    expect(updateOperationGroupStatusMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operationGroupId: 'group-1',
        status: 'failed',
        preflightStatus: 'failed',
        preflightResult: { validateOnly: false },
        errorCode: 'GOOGLE_VALIDATION_FAILED',
      }),
    );
    expect(createGoogleRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        responseSummary: { validateOnly: false },
        errorCode: 'GOOGLE_VALIDATION_FAILED',
        errorMessage: 'Google rejected the regular hours payload.',
      }),
    );
  });

  it('maps thrown preflight errors to failed group results and audit details', async () => {
    const exportPreflight = vi.fn().mockRejectedValue(new Error('validateOnly timed out'));

    const result = await runRequiredExportPreflights(input({ exportPreflight }));

    expect(result.get('operatingHours.weekly.1')).toMatchObject({
      code: 'EXTERNAL_API_TIMEOUT',
      message: 'validateOnly timed out',
      retryable: true,
    });
    expect(createGoogleRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        responseSummary: { thrown: true, message: 'validateOnly timed out' },
        errorCode: 'EXTERNAL_API_TIMEOUT',
        errorMessage: 'validateOnly timed out',
      }),
    );
  });
});
