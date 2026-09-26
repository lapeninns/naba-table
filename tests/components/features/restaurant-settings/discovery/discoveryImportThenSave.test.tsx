import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';
import { useOpsDualSync } from '@/hooks/ops/useOpsDualSync';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { publishDualSyncDecisions } from '@/services/ops/dual-sync';

import type { BusinessContextSaveInput } from '@/hooks/ops/useOpsRestaurantBusinessContext';
import type {
  DualSyncPublishResponse,
  RestaurantBusinessContextCategory,
  RestaurantBusinessContextFamily,
  RestaurantBusinessContextSnapshot,
} from '@/services/ops/restaurants';

const restaurantService = vi.hoisted(() => ({
  getBusinessContext: vi.fn(),
  updateBusinessContext: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));
vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
}));
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: toastMock }));
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

const restaurantId = 'rest-1';
const PUB_ID = '11111111-1111-4111-8111-111111111111';

const EMPTY: RestaurantBusinessContextFamily = {
  businessDetails: null,
  links: [],
  categories: [],
  serviceAreas: [],
  attributes: [],
  serviceItems: [],
};

function category(displayName: string): RestaurantBusinessContextCategory {
  return {
    id: PUB_ID,
    displayName,
    categoryCode: 'gcid:pub',
    moreHoursTypes: [],
    isPrimary: true,
    source: 'nabatable',
    managedBy: 'nabatable',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };
}

function snapshot(categoryName: string, revision: number): RestaurantBusinessContextSnapshot {
  return {
    revision,
    core: { ...EMPTY, categories: [category(categoryName)] },
    providerSnapshot: EMPTY,
  } as RestaurantBusinessContextSnapshot;
}

function importCategory() {
  vi.mocked(publishDualSyncDecisions).mockResolvedValue({
    failures: [],
  } as unknown as DualSyncPublishResponse);
  return {
    clientRequestId: 'intent-1',
    decisions: [
      {
        fieldKey: 'businessContext.categories.primary',
        sectionKey: 'businessContext.categories' as const,
        action: 'import_from_google' as const,
        pinnedCoreHash: 'core',
        pinnedGbpHash: 'gbp',
      },
    ],
  };
}

function echoSave(revision: number) {
  return async (_id: string, payload: BusinessContextSaveInput) => ({
    ...snapshot('unused', revision),
    core: {
      ...EMPTY,
      categories: (payload.categories ?? []).map((row, index) => ({
        ...category(row.displayName),
        id: row.id ?? `22222222-2222-4222-8222-22222222222${index}`,
        isPrimary: row.isPrimary ?? false,
      })),
    },
  });
}

function setup() {
  const queryClient = createAppQueryClient();
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(
    () => ({
      editor: useRestaurantBusinessContextEditor({ restaurantId }),
      dualSync: useOpsDualSync({ restaurantId, stateEnabled: false }),
    }),
    { wrapper: Wrapper },
  );
}

describe('Discovery save after a Google import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('@contract the imported value survives the next Discovery save', async () => {
    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('Pub', 1));
    restaurantService.updateBusinessContext.mockImplementation(
      async (_id: string, payload: BusinessContextSaveInput) => ({
        ...snapshot('unused', 3),
        core: {
          ...EMPTY,
          categories: (payload.categories ?? []).map((row, index) => ({
            ...category(row.displayName),
            id: row.id ?? `22222222-2222-4222-8222-22222222222${index}`,
            isPrimary: row.isPrimary ?? false,
          })),
        },
      }),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.editor.categories).toHaveLength(1));

    // Staff add a second category but do not save yet.
    act(() => {
      result.current.editor.addCategory('Bar');
    });
    expect(result.current.editor.dirty.categories).toBe(true);

    // Meanwhile "Use Google's value" imports a new name for the saved category.
    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('Gastropub', 2));
    vi.mocked(publishDualSyncDecisions).mockResolvedValue({
      failures: [],
    } as unknown as DualSyncPublishResponse);
    await act(async () => {
      await result.current.dualSync.publishMutation.mutateAsync({
        clientRequestId: 'intent-1',
        decisions: [
          {
            fieldKey: 'businessContext.categories.primary',
            sectionKey: 'businessContext.categories',
            action: 'import_from_google',
            pinnedCoreHash: 'core',
            pinnedGbpHash: 'gbp',
          },
        ],
      });
    });
    // The import refreshed the Discovery snapshot and the open draft was rebased onto it.
    await waitFor(() =>
      expect(result.current.editor.categories.map((row) => row.displayName)).toEqual([
        'Gastropub',
        'Bar',
      ]),
    );

    await act(async () => {
      await result.current.editor.saveAll();
    });

    expect(restaurantService.updateBusinessContext).toHaveBeenCalledTimes(1);
    const [, payload] = restaurantService.updateBusinessContext.mock.calls[0] as [
      string,
      BusinessContextSaveInput,
    ];
    expect(payload.categories?.map((row) => row.displayName)).toEqual(['Gastropub', 'Bar']);
    // The save is conditioned on the post-import revision, not the one the draft started from.
    expect(payload.expectedRevision).toBe(2);
  });

  it('@contract "Use Google\'s value" wins over a local edit of the same row, and staff are told', async () => {
    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('Pub', 1));
    restaurantService.updateBusinessContext.mockImplementation(echoSave(3));
    const { result } = setup();
    await waitFor(() => expect(result.current.editor.categories).toHaveLength(1));

    act(() => {
      result.current.editor.updateCategory(PUB_ID, 'displayName', 'Village pub');
    });

    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('Gastropub', 2));
    const request = importCategory();
    await act(async () => {
      await result.current.dualSync.publishMutation.mutateAsync(request);
    });
    await waitFor(() =>
      expect(result.current.editor.categories.map((row) => row.displayName)).toEqual(['Gastropub']),
    );
    expect(toastMock.warning).toHaveBeenCalledTimes(1);
    expect(toastMock.warning.mock.calls[0]?.[0]).toContain('Categories');
    // Nothing left to save: the import is the saved value.
    expect(result.current.editor.dirty.categories).toBe(false);
  });

  it('@contract after a 409 STALE_WRITE the draft rebases onto the latest snapshot and the next save succeeds', async () => {
    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('Pub', 1));
    const { result } = setup();
    await waitFor(() => expect(result.current.editor.categories).toHaveLength(1));

    act(() => {
      result.current.editor.addCategory('Bar');
    });

    // Someone else saved underneath this draft.
    restaurantService.updateBusinessContext.mockRejectedValueOnce(
      new HttpError({ message: 'stale', status: 409, code: 'STALE_WRITE' }),
    );
    restaurantService.getBusinessContext.mockResolvedValueOnce(snapshot('Inn', 5));
    await act(async () => {
      await result.current.editor.saveAll();
    });
    expect(result.current.editor.saveFailure).not.toBeNull();

    // Exactly one reload of the snapshot, and the draft keeps my new row on top of it.
    await waitFor(() =>
      expect(result.current.editor.categories.map((row) => row.displayName)).toEqual([
        'Inn',
        'Bar',
      ]),
    );
    expect(restaurantService.getBusinessContext).toHaveBeenCalledTimes(2);

    restaurantService.updateBusinessContext.mockImplementationOnce(echoSave(6));
    await act(async () => {
      await result.current.editor.saveAll();
    });
    const [, payload] = restaurantService.updateBusinessContext.mock.calls[1] as [
      string,
      BusinessContextSaveInput,
    ];
    expect(payload.expectedRevision).toBe(5);
    expect(payload.categories?.map((row) => row.displayName)).toEqual(['Inn', 'Bar']);
    expect(result.current.editor.dirty.categories).toBe(false);
  });
});
