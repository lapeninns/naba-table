import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each query mirrors TanStack's shape after a failed refetch: the last data stays and `error` is set.
const state = vi.hoisted(() => ({
  details: {
    data: null as RestaurantProfile | null,
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
  },
  occasions: {
    data: null as OpsOccasion[] | null,
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
  },
  // Hours, meal times, table times and rules: one snapshot with its revision.
  availability: {
    data: null as AvailabilitySnapshot | null,
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
  },
  mutation: { isPending: false, mutateAsync: vi.fn() },
}));

vi.mock('@/contexts/ops-services', () => ({
  useOccasionService: () => ({
    createOccasion: vi.fn(),
    updateOccasion: vi.fn(),
    deleteOccasion: vi.fn(),
  }),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant/availability',
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: vi.fn() }));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ permissions: { isPlatformAdmin: false } }),
}));

vi.mock('@src/hooks/ops/useOpsSaveAvailability', () => ({
  useOpsAvailability: () => state.availability,
  useOpsSaveAvailability: () => ({ isPending: false, mutateAsync: async () => undefined }),
}));

vi.mock('@/hooks/ops/useOccasions', () => ({
  useOpsOccasions: () => state.occasions,
}));

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => state.details,
  useOpsUpdateRestaurantDetails: () => state.mutation,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: { fields: [] }, error: null, isError: false, isLoading: false },
  }),
}));

import { AvailabilitySettingsPage } from '@/components/features/restaurant-settings/availability/AvailabilitySettingsPage';
import { HttpError } from '@/lib/http/errors';

import type { AvailabilitySnapshot } from '@/services/ops/availability';
import type { OpsOccasion } from '@/services/ops/occasions';
import type { RestaurantProfile } from '@/services/ops/restaurants';

function buildOccasion(key: string, label: string, displayOrder: number): OpsOccasion {
  return {
    key,
    label,
    shortLabel: label,
    description: null,
    availability: [{ kind: 'anytime' }],
    defaultDurationMinutes: 90,
    displayOrder,
    isActive: true,
    isBuiltin: true,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

function seedLoadedState() {
  state.details.data = {
    id: 'rest-1',
    name: 'Old Crown Girton',
    slug: 'old-crown-girton',
    timezone: 'Europe/London',
    contactEmail: 'ops@example.com',
    contactPhone: '+441223277217',
    address: '1 High Street',
    businessDescription: null,
    managerDailySummaryEnabled: false,
    managerNotificationPhone: null,
    googleMapUrl: null,
    googleReviewUrl: null,
    bookingPolicy: null,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
    updatedAt: null,
  };
  state.occasions.data = [
    buildOccasion('lunch', 'Lunch', 10),
    buildOccasion('dinner', 'Dinner', 20),
  ];
  const hours = {
    updatedAt: '2026-04-30T12:00:00.000Z',
    weekly: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      opensAt: '12:00',
      closesAt: '22:00',
      isClosed: false,
      notes: null,
      reservationIntervalMinutes: 15,
      reservationSlotTimes: null,
    })),
    overrides: [],
  };
  const servicePeriods = Array.from({ length: 7 }).flatMap((_, dayOfWeek) => [
    {
      id: `lunch-${dayOfWeek}`,
      name: 'Lunch',
      dayOfWeek,
      startTime: '12:00',
      endTime: '15:00',
      bookingOption: 'lunch',
      updatedAt: null,
    },
    {
      id: `dinner-${dayOfWeek}`,
      name: 'Dinner',
      dayOfWeek,
      startTime: '17:00',
      endTime: '22:00',
      bookingOption: 'dinner',
      updatedAt: null,
    },
  ]);
  state.availability.data = {
    restaurantId: 'rest-1',
    revision: 'rev-1',
    hours,
    servicePeriods,
    turnBands: { restaurantId: 'rest-1', bands: {}, defaults: {} },
    rules: {
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
      bookingPolicy: null,
      updatedAt: null,
    },
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <AvailabilitySettingsPage restaurantId="rest-1" />
    </QueryClientProvider>
  );
  const view = render(tree());
  return { rerender: () => view.rerender(tree()) };
}

const refreshFailure = new HttpError({
  message: 'Service Unavailable',
  status: 503,
  code: 'HTTP_503',
});

describe('AvailabilitySettingsPage load errors', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Element.prototype.scrollIntoView = vi.fn();
    for (const query of [state.details, state.occasions, state.availability]) {
      query.data = null;
      query.error = null;
      query.refetch.mockReset();
    }
    seedLoadedState();
  });

  it('keeps the editor, unsaved draft and save bar when a background refetch fails', async () => {
    const user = userEvent.setup();
    const view = renderPage();

    await user.click(
      await screen.findByLabelText('Increase last seating before closing by 15 minutes'),
    );
    expect(
      within(screen.getByRole('region', { name: 'Unsaved changes' })).getByText('1 unsaved change'),
    ).toBeInTheDocument();

    // The onSettled refetch after another tab's save fails; TanStack keeps the last data.
    state.availability.error = refreshFailure;
    view.rerender();

    expect(await screen.findByText('Couldn’t refresh saved settings')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    expect(screen.queryByText('Service Unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Availability settings couldn’t load')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Booking rules' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Unsaved changes' })).getByText('1 unsaved change'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.availability.refetch).toHaveBeenCalledTimes(1);
    expect(state.occasions.refetch).not.toHaveBeenCalled();
  });

  it('still blocks with a retryable error when a query has never loaded', async () => {
    state.availability.data = null;
    state.availability.error = refreshFailure;
    renderPage();

    expect(await screen.findByText('Availability settings couldn’t load')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Booking rules' })).not.toBeInTheDocument();
  });
});
