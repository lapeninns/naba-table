import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';
import { HttpError } from '@/lib/http/errors';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ permissions: { canManageSettings: true } }),
}));

// Mirrors TanStack's shape after a failed refetch: the last data stays and `error` is set.
const connectionResult = {
  data: undefined as GoogleBusinessProfileConnection | undefined,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

const idleMutation = { mutate: vi.fn(), isPending: false, error: null };

// The review workspace owns the unsaved decisions and their save bar; a stand-in with local
// state proves the workspace stays mounted.
function DualSyncShellStandIn() {
  const [note, setNote] = useState('');
  return (
    <div data-testid="dual-sync-shell">
      <label>
        Review decision
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {note ? <div role="region" aria-label="Unsaved changes" /> : null}
    </div>
  );
}

vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncShell', () => ({
  DualSyncShell: () => <DualSyncShellStandIn />,
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => connectionResult,
  useOpsGoogleBusinessProfileAvailableLocations: () => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  useOpsStartGoogleBusinessProfileAuthorization: () => idleMutation,
  useOpsLinkGoogleBusinessProfileLocation: () => idleMutation,
  useOpsDisconnectGoogleBusinessProfile: () => idleMutation,
  useOpsGbpOperatorState: () => ({
    connectionQuery: { data: undefined, isLoading: true, error: null },
    terminalNoticesQuery: { data: undefined },
    setWriteAccessMutation: { mutateAsync: vi.fn(), isPending: false, error: null },
    setNotificationParticipationMutation: { mutateAsync: vi.fn(), isPending: false, error: null },
  }),
}));

function emptyBusinessInfo(): GoogleBusinessProfileConnection['businessInfo'] {
  return {
    details: null,
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
    coreNormalization: {
      operatingHours: {
        source: 'unavailable',
        matchStatus: 'unavailable',
        summary: '',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'unavailable',
        matchStatus: 'unavailable',
        summary: '',
        warnings: [],
        periods: [],
      },
      bookingHours: {
        matchStatus: 'unavailable',
        summary: '',
        warnings: [],
        missingInputs: [],
      },
    },
  };
}

function linkedConnection(): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: true,
    connectedGoogleEmail: 'ops@example.com',
    connectedGoogleName: null,
    externalAccountId: 'a-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'l-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Nabatable Main',
    externalPlaceId: 'place-1',
    lastPullAt: '2026-04-20T10:00:00.000Z',
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: emptyBusinessInfo(),
  };
}

const refreshFailure = new HttpError({
  message: 'Service Unavailable',
  status: 503,
  code: 'HTTP_503',
});

describe('GoogleBusinessProfileSection load errors', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/app/settings/restaurant/google-business-profile');
    connectionResult.data = undefined;
    connectionResult.error = null;
    connectionResult.isLoading = false;
    connectionResult.isFetching = false;
    connectionResult.refetch.mockReset();
  });

  it('keeps the review workspace and its unsaved decisions when a background refetch fails', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection();
    const view = render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.type(await screen.findByLabelText('Review decision'), 'Keep ours');
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeInTheDocument();

    connectionResult.error = refreshFailure;
    view.rerender(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(await screen.findByText('Couldn’t refresh saved settings')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    expect(screen.queryByText('Service Unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Unable to load Google Business Profile')).not.toBeInTheDocument();
    expect(screen.getByTestId('gbp-connection-card')).toBeInTheDocument();
    expect(screen.getByLabelText('Review decision')).toHaveValue('Keep ours');
    expect(screen.getByRole('region', { name: 'Unsaved changes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(connectionResult.refetch).toHaveBeenCalledTimes(1);
  });

  it('still blocks with a retryable error when the connection has never loaded', () => {
    connectionResult.error = refreshFailure;
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText('Unable to load Google Business Profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByTestId('gbp-connection-card')).not.toBeInTheDocument();
  });
});
