import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const restaurantService = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/contexts/ops-services', () => ({
  useRestaurantService: () => restaurantService,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
  useRegisterOptionalOpsUnsavedChanges: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({
    data: {
      isConfigured: false,
      provider: 'google_business_profile',
      status: 'unlinked',
      businessInfo: null,
    },
  }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: { fields: [] }, error: null, isError: false, isLoading: false },
  }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantLogoUpload', () => ({
  useOpsRestaurantLogoUpload: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useOpsRemoveRestaurantLogo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { RestaurantProfileSection } from '@/components/features/restaurant-settings/RestaurantProfileSection';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type { RestaurantProfile } from '@/services/ops/restaurants';

const profile: RestaurantProfile = {
  id: 'rest-1',
  name: 'Old Crown Girton',
  slug: 'old-crown-girton',
  timezone: 'Europe/London',
  capacity: 40,
  contactEmail: 'ops@example.com',
  contactPhone: '+441223277217',
  address: '1 High Street',
  businessDescription: null,
  managerDailySummaryEnabled: false,
  managerNotificationPhone: null,
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: null,
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
  updatedAt: '2026-04-30T18:30:00.000Z',
};

function createClient(): QueryClient {
  const queryClient = createAppQueryClient();
  // Retries would only delay the rejected refetch these tests assert on.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  return queryClient;
}

function renderSection(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RestaurantProfileSection restaurantId="rest-1" />
    </QueryClientProvider>,
  );
}

const refreshFailure = new HttpError({
  message: 'Service Unavailable',
  status: 503,
  code: 'HTTP_503',
});

describe('RestaurantProfileSection load errors', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    restaurantService.getProfile.mockReset();
    restaurantService.updateProfile.mockReset();
  });

  it('keeps the editor, unsaved draft and save bar when a background refetch fails', async () => {
    const user = userEvent.setup();
    const queryClient = createClient();
    restaurantService.getProfile.mockResolvedValueOnce(profile);
    renderSection(queryClient);

    const description = await screen.findByRole('textbox', { name: /business description/i });
    await user.type(description, 'Family friendly pub');
    expect(
      within(screen.getByRole('region', { name: 'Unsaved changes' })).getByText('1 unsaved change'),
    ).toBeInTheDocument();

    restaurantService.getProfile.mockRejectedValueOnce(refreshFailure);
    await queryClient.refetchQueries({ queryKey: queryKeys.opsRestaurants.detail('rest-1') });

    expect(await screen.findByText('Couldn’t refresh saved settings')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    expect(screen.queryByText('Service Unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load the restaurant profile')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /business description/i })).toHaveValue(
      'Family friendly pub',
    );
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeInTheDocument();
  });

  it('still blocks with a retryable error when the first load fails', async () => {
    const queryClient = createClient();
    restaurantService.getProfile.mockRejectedValue(refreshFailure);
    renderSection(queryClient);

    expect(await screen.findByText('Couldn’t load the restaurant profile')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /business description/i }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(restaurantService.getProfile).toHaveBeenCalledTimes(1));
  });
});
