import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { fetchRestaurantBySlug } from '../../api/fetchRestaurantBySlug';
import { useReservationWizard } from '../useReservationWizard';

import type { VenueDetails } from '@reserve/shared/config/venue';

// Mock dependencies
vi.mock('../../api/fetchRestaurantBySlug');
vi.mock('../../di', () => ({
  useWizardDependencies: () => ({
    analytics: { track: vi.fn() },
    haptics: { trigger: vi.fn() },
    navigator: { push: vi.fn() },
    errorReporter: { capture: vi.fn() },
  }),
}));
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));
vi.mock('../../api/useCreateReservation', () => ({
  useCreateReservation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isPaused: false,
    isSuccess: false,
  }),
}));
vi.mock('../../api/useCreateOpsReservation', () => ({
  useCreateOpsReservation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isPaused: false,
    isSuccess: false,
  }),
}));
vi.mock('../../model/store', async () => {
  const actual = await vi.importActual('../../model/store');
  return {
    ...actual,
  };
});

// Since useWizardStore is likely a zustand store, we might need to reset it between tests if it's a singleton.
// But looking at useReservationWizard, it calls useWizardStore(initialDetails).
// If useWizardStore is a hook that creates a store or uses a global one, we need to be careful.
// Let's assume for now it works with renderHook.

describe('useReservationWizard Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fetchRestaurantBySlugMock = fetchRestaurantBySlug as vi.MockedFunction<
    typeof fetchRestaurantBySlug
  >;

  it('hydrates venue details when slug is provided but details are missing', async () => {
    const mockVenue: VenueDetails = {
      id: '123',
      slug: 'cafe-roma',
      name: 'Cafe Roma',
      address: '123 Main St',
      timezone: 'America/New_York',
      phone: '555-1234',
      email: 'test@example.com',
      policy: 'Policy',
      logoUrl: null,
      googleMapUrl: null,
    };

    fetchRestaurantBySlugMock.mockResolvedValue(mockVenue);

    const { result } = renderHook(() => useReservationWizard({ restaurantSlug: 'cafe-roma' }));

    // Initial state should have slug but empty details
    expect(result.current.state.details.restaurantSlug).toBe('cafe-roma');
    // It might be empty initially
    expect(result.current.state.details.restaurantName).toBe('');

    // Wait for hydration
    await waitFor(() => {
      expect(result.current.state.details.restaurantName).toBe('Cafe Roma');
    });

    expect(result.current.state.details.restaurantAddress).toBe('123 Main St');
    expect(result.current.state.details.restaurantTimezone).toBe('America/New_York');
    expect(fetchRestaurantBySlug).toHaveBeenCalledWith('cafe-roma', expect.anything());
  });

  it('does not hydrate if details are already present', async () => {
    const { result } = renderHook(() =>
      useReservationWizard({
        restaurantSlug: 'cafe-roma',
        restaurantName: 'Existing Name',
      }),
    );

    expect(fetchRestaurantBySlugMock).not.toHaveBeenCalled();
    expect(result.current.state.details.restaurantName).toBe('Existing Name');
  });

  it('does not overwrite in-progress edits when hydration resolves', async () => {
    let resolveVenue: ((venue: VenueDetails) => void) | null = null;

    fetchRestaurantBySlugMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVenue = resolve;
        }),
    );

    const { result } = renderHook(() => useReservationWizard({ restaurantSlug: 'cafe-roma' }));

    act(() => {
      result.current.actions.updateDetails('party', 5);
      result.current.actions.updateDetails('name', 'Guest Editor');
    });

    act(() => {
      resolveVenue?.({
        id: '123',
        slug: 'cafe-roma',
        name: 'Cafe Roma',
        address: '123 Main St',
        timezone: 'America/New_York',
        phone: '555-1234',
        email: 'test@example.com',
        policy: 'Policy',
        logoUrl: null,
        googleMapUrl: null,
      });
    });

    await waitFor(() => {
      expect(result.current.state.details.restaurantName).toBe('Cafe Roma');
    });

    expect(result.current.state.details.party).toBe(5);
    expect(result.current.state.details.name).toBe('Guest Editor');
  });

  it('attempts hydration even when slug is "default" (no fallback)', async () => {
    fetchRestaurantBySlugMock.mockResolvedValue({
      id: '123',
      slug: 'default',
      name: 'Default Venue',
      address: 'Somewhere',
      timezone: 'UTC',
      phone: '',
      email: '',
      policy: '',
      logoUrl: null,
      googleMapUrl: null,
    });

    renderHook(() => useReservationWizard({ restaurantSlug: 'default' }));

    await waitFor(() => {
      expect(fetchRestaurantBySlugMock).toHaveBeenCalledWith('default', expect.anything());
    });
  });
});
