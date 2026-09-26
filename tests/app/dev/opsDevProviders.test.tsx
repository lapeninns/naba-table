import { renderHook, waitFor } from '@testing-library/react';
import { useMemo, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAvailabilityService } from '@/contexts/availability-service';
import { httpAvailabilityService } from '@/services/ops/availability';
import { DEV_RESTAURANT_ID } from '@/src/app/(public)/dev/_mocks/devIds';
import { createOpsDevServiceFactories } from '@/src/app/(public)/dev/_mocks/services/devFactories';
import { OpsDevProviders } from '@/src/app/(public)/dev/_shared/OpsDevProviders';

function Wrapper({ children }: { children: ReactNode }) {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);
  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      {children}
    </OpsDevProviders>
  );
}

describe('OpsDevProviders', () => {
  it('serves the Availability snapshot and save from the in-memory dev services', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useAvailabilityService(), { wrapper: Wrapper });

    const service = result.current;
    expect(service).not.toBe(httpAvailabilityService);

    const snapshot = await service.getAvailability(DEV_RESTAURANT_ID);
    expect(snapshot.restaurantId).toBe(DEV_RESTAURANT_ID);
    expect(typeof snapshot.revision).toBe('string');

    const saved = await service.saveAvailability(DEV_RESTAURANT_ID, {
      rules: { reservationLastSeatingBufferMinutes: 45 },
      expectedRevision: snapshot.revision,
    });
    expect(saved.rules.reservationLastSeatingBufferMinutes).toBe(45);

    // The adapter keeps the command contract: a save from the old revision is refused.
    await expect(
      service.saveAvailability(DEV_RESTAURANT_ID, {
        rules: { reservationLastSeatingBufferMinutes: 60 },
        expectedRevision: snapshot.revision,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'STALE_WRITE' });

    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
    fetchSpy.mockRestore();
  });
});
