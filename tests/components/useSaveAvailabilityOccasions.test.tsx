import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSaveAvailabilityOccasions } from '@/components/features/restaurant-settings/availability/useSaveAvailabilityOccasions';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type {
  CreateOccasionInput,
  OccasionService,
  OpsOccasion,
  UpdateOccasionInput,
} from '@/services/ops/occasions';
import type { ReactNode } from 'react';

const occasionService = vi.hoisted(() => ({
  listOccasions: vi.fn(),
  createOccasion: vi.fn(),
  updateOccasion: vi.fn(),
  deleteOccasion: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({
  useOccasionService: (): OccasionService => occasionService,
}));

const SCHEDULE_KEY = ['reservations', 'schedule', 'the-pub', '2026-10-01', 2] as const;

function makeOccasion(overrides: Partial<OpsOccasion> & { key: string }): OpsOccasion {
  return {
    key: overrides.key,
    label: overrides.label ?? overrides.key,
    shortLabel: overrides.shortLabel ?? overrides.label ?? overrides.key,
    description: overrides.description ?? null,
    availability: overrides.availability ?? [{ kind: 'anytime' }],
    defaultDurationMinutes: overrides.defaultDurationMinutes ?? 90,
    displayOrder: overrides.displayOrder ?? 10,
    isActive: overrides.isActive ?? true,
    isBuiltin: overrides.isBuiltin ?? false,
  };
}

/** A fake occasions API with the real route's semantics: creating an existing key answers 409. */
function installFakeServer(initial: OpsOccasion[]) {
  const server = new Map(initial.map((occasion) => [occasion.key, occasion]));
  occasionService.listOccasions.mockImplementation(async () => [...server.values()]);
  occasionService.createOccasion.mockImplementation(async (input: CreateOccasionInput) => {
    if (server.has(input.key)) {
      throw new HttpError({ message: 'Conflict', status: 409 });
    }
    const created = makeOccasion({ ...input, availability: input.availability ?? [] });
    server.set(input.key, created);
    return created;
  });
  occasionService.updateOccasion.mockImplementation(
    async (key: string, input: UpdateOccasionInput) => {
      const current = server.get(key);
      if (!current) {
        throw new HttpError({ message: 'Not Found', status: 404 });
      }
      const updated = { ...current, ...input } as OpsOccasion;
      server.set(key, updated);
      return updated;
    },
  );
  occasionService.deleteOccasion.mockImplementation(async (key: string) => {
    if (!server.delete(key)) {
      throw new HttpError({ message: 'Not Found', status: 404 });
    }
  });
  return server;
}

function renderSave(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSaveAvailabilityOccasions(), { wrapper }).result;
}

describe('useSaveAvailabilityOccasions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createAppQueryClient();
  });

  function setUpPartialFailure() {
    const lunch = makeOccasion({ key: 'lunch', label: 'Lunch', isBuiltin: true });
    const server = installFakeServer([lunch]);
    queryClient.setQueryData(queryKeys.opsOccasions.list(), [lunch]);
    queryClient.setQueryData(SCHEDULE_KEY, { slots: [] });
    occasionService.updateOccasion.mockRejectedValueOnce(
      new HttpError({ message: 'Internal Server Error', status: 500 }),
    );
    return {
      server,
      originalOccasions: [lunch],
      draftOccasions: [
        { ...lunch, label: 'Lunch service' },
        makeOccasion({ key: 'supper', label: 'Supper', displayOrder: 30 }),
      ],
    };
  }

  it('surfaces a partial failure and marks the occasions list and guest schedule stale', async () => {
    const { server, draftOccasions, originalOccasions } = setUpPartialFailure();

    const result = renderSave(queryClient);
    await expect(result.current({ draftOccasions, originalOccasions })).rejects.toMatchObject({
      status: 500,
    });

    // The create landed before the update failed.
    expect(server.has('supper')).toBe(true);
    expect(queryClient.getQueryState(queryKeys.opsOccasions.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(SCHEDULE_KEY)?.isInvalidated).toBe(true);
  });

  it('retries without re-creating booking types the failed attempt already saved', async () => {
    const { server, draftOccasions, originalOccasions } = setUpPartialFailure();

    const result = renderSave(queryClient);
    await expect(result.current({ draftOccasions, originalOccasions })).rejects.toMatchObject({
      status: 500,
    });

    // Staff retry with the same unsaved draft against the same (uncommitted) baseline.
    await expect(result.current({ draftOccasions, originalOccasions })).resolves.toBeDefined();

    expect(occasionService.createOccasion).toHaveBeenCalledTimes(1);
    expect(occasionService.updateOccasion).toHaveBeenCalledTimes(2);
    expect(occasionService.updateOccasion).toHaveBeenLastCalledWith(
      'lunch',
      expect.objectContaining({ label: 'Lunch service' }),
    );
    expect(server.get('lunch')?.label).toBe('Lunch service');
  });

  it('skips deletes the server has already applied when retrying', async () => {
    const seasonal = makeOccasion({ key: 'seasonal', label: 'Seasonal' });
    installFakeServer([]);
    queryClient.setQueryData(queryKeys.opsOccasions.list(), [seasonal]);
    await queryClient.invalidateQueries({ queryKey: queryKeys.opsOccasions.list() });

    const result = renderSave(queryClient);
    await expect(
      result.current({ draftOccasions: [], originalOccasions: [seasonal] }),
    ).resolves.toBeDefined();

    expect(occasionService.deleteOccasion).not.toHaveBeenCalled();
  });

  it('invalidates the occasions list and guest schedule once after a successful save', async () => {
    const lunch = makeOccasion({ key: 'lunch', label: 'Lunch', isBuiltin: true });
    installFakeServer([lunch]);
    queryClient.setQueryData(queryKeys.opsOccasions.list(), [lunch]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const result = renderSave(queryClient);
    await result.current({
      draftOccasions: [lunch, makeOccasion({ key: 'supper', label: 'Supper' })],
      originalOccasions: [lunch],
    });

    expect(occasionService.createOccasion).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.opsOccasions.list() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reservations', 'schedule'] });
  });
});
