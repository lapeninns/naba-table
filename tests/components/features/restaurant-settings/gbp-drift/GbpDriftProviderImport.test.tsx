import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GbpDriftProvider } from '@/components/features/restaurant-settings/gbp-drift/GbpDriftProvider';
import { useGbpDrift } from '@/components/features/restaurant-settings/gbp-drift/useGbpDrift';

import type { GbpDriftContextValue } from '@/components/features/restaurant-settings/gbp-drift/types';
import type { DualSyncSectionKey } from '@/server/dual-sync';
import type {
  DualSyncFieldSummary,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
} from '@/services/ops/dual-sync';

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
const mutateAsync = vi.hoisted(() => vi.fn());
const fields = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({ data: { status: 'linked' }, isLoading: false }),
}));
vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: { fields: fields.current }, isLoading: false },
    publishMutation: { mutateAsync, isPending: false },
    isPublishPending: false,
  }),
}));

function driftField(fieldKey: string, label: string): DualSyncFieldSummary {
  const sectionKey: DualSyncSectionKey = 'profile';
  return {
    fieldKey,
    sectionKey,
    kind: 'profile',
    label,
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey,
      sectionKey,
      authority: 'bidirectional_manual',
      riskLevel: 'medium',
      importable: true,
      exportable: true,
      requiresManualReview: false,
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Nabatable value',
    gbpValue: 'Google value',
    coreCanonicalHash: `${fieldKey}:core`,
    gbpCanonicalHash: `${fieldKey}:gbp`,
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'drifted',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
  } satisfies DualSyncFieldSummary;
}

function response(failedFieldKeys: string[]): DualSyncPublishResponse {
  return {
    publishJobId: 'job-1',
    restaurantId: 'rest-1',
    totalDecisions: 2,
    succeededCount: 2 - failedFieldKeys.length,
    failedCount: failedFieldKeys.length,
    skippedCount: 0,
    operations: [],
    failures: failedFieldKeys.map((fieldKey) => ({
      fieldKey,
      failure: {
        code: 'PORT_FAILURE',
        message: 'SECRET_PROVIDER_TEXT',
        retryable: false,
      },
    })),
  } as unknown as DualSyncPublishResponse;
}

let drift: GbpDriftContextValue;

function Capture({ onValue }: { onValue: (value: GbpDriftContextValue) => void }) {
  const value = useGbpDrift();
  useEffect(() => onValue(value), [onValue, value]);
  return null;
}

const captureDrift = (value: GbpDriftContextValue) => {
  drift = value;
};

function renderProvider() {
  render(
    <GbpDriftProvider restaurantId="rest-1">
      <Capture onValue={captureDrift} />
    </GbpDriftProvider>,
  );
  // A staff member typed a local value for both fields (a draft override).
  act(() => {
    drift.registerDraftOverride('profile.name', 'Typed name');
    drift.registerDraftOverride('profile.businessDescription', 'Typed description');
  });
}

function sentRequest(call: number): DualSyncPublishRequest {
  return mutateAsync.mock.calls[call]?.[0] as DualSyncPublishRequest;
}

describe('GbpDriftProvider import outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fields.current = [
      driftField('profile.name', 'Business name'),
      driftField('profile.businessDescription', 'Description'),
    ];
  });

  it('@contract confirms a full import and clears every imported override', async () => {
    mutateAsync.mockResolvedValue(response([]));
    renderProvider();

    await act(async () => {
      await drift.applyAllFromGoogle();
    });

    expect(toastMock.success).toHaveBeenCalledWith('2 Google fields imported to Nabatable.');
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(drift.fieldViewByKey.get('profile.name')?.hasDraftOverride).toBe(false);
    expect(drift.fieldViewByKey.get('profile.businessDescription')?.hasDraftOverride).toBe(false);
  });

  it('@contract warns on a partial import, names what failed and keeps its override', async () => {
    mutateAsync.mockResolvedValue(response(['profile.businessDescription']));
    renderProvider();

    await act(async () => {
      await drift.applyAllFromGoogle();
    });

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Imported 1 of 2 Google fields. Not imported: Description.',
    );
    expect(JSON.stringify(toastMock.warning.mock.calls)).not.toContain('SECRET_PROVIDER_TEXT');
    expect(drift.fieldViewByKey.get('profile.name')?.hasDraftOverride).toBe(false);
    expect(drift.fieldViewByKey.get('profile.businessDescription')?.hasDraftOverride).toBe(true);
  });

  it('@contract reports an import where every field failed as an error', async () => {
    mutateAsync.mockResolvedValue(response(['profile.name', 'profile.businessDescription']));
    renderProvider();

    await act(async () => {
      await drift.applyAllFromGoogle();
    });

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalledWith(
      'Google fields could not be imported: Business name and Description.',
    );
    expect(drift.fieldViewByKey.get('profile.name')?.hasDraftOverride).toBe(true);
  });

  it('@contract reuses the request id when the same import is retried, and not after it lands', async () => {
    mutateAsync.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mutateAsync.mockResolvedValue(response([]));
    renderProvider();

    await act(async () => {
      await drift.applyFieldFromGoogle('profile.name');
    });
    expect(toastMock.error).toHaveBeenCalledTimes(1);
    expect(drift.fieldViewByKey.get('profile.name')?.hasDraftOverride).toBe(true);

    await act(async () => {
      await drift.applyFieldFromGoogle('profile.name');
    });
    const firstId = sentRequest(0).clientRequestId;
    expect(firstId).toEqual(expect.any(String));
    expect(sentRequest(1).clientRequestId).toBe(firstId);

    await act(async () => {
      await drift.applyFieldFromGoogle('profile.name');
    });
    expect(sentRequest(2).clientRequestId).not.toBe(firstId);
  });

  it('@contract a replayed retry whose stored operation failed is a warning, not success', async () => {
    // The first attempt threw after the server started the batch; the retry reuses the id and
    // the server replays the stored batch. Only operations[].status carries the real result.
    mutateAsync.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    mutateAsync.mockResolvedValueOnce({
      ...response([]),
      succeededCount: 1,
      failedCount: 1,
      operations: [
        { fieldKey: 'profile.name', status: 'succeeded' },
        { fieldKey: 'profile.businessDescription', status: 'failed' },
      ],
    } as unknown as DualSyncPublishResponse);
    renderProvider();

    await act(async () => {
      await drift.applyAllFromGoogle();
    });
    await act(async () => {
      await drift.applyAllFromGoogle();
    });

    expect(sentRequest(1).clientRequestId).toBe(sentRequest(0).clientRequestId);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.warning).toHaveBeenCalledWith(
      'Imported 1 of 2 Google fields. Not imported: Description.',
    );
    expect(drift.fieldViewByKey.get('profile.name')?.hasDraftOverride).toBe(false);
    expect(drift.fieldViewByKey.get('profile.businessDescription')?.hasDraftOverride).toBe(true);
  });
});
