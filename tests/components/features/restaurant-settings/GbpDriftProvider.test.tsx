import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectionState = vi.hoisted(() => ({
  data: null as unknown,
  isLoading: false,
  error: null as Error | null,
}));
const dualSyncState = { current: makeDualSyncHookState() };
const useOpsDualSync = vi.hoisted(() => vi.fn(() => dualSyncState.current));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => connectionState,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync,
}));

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({
    restaurantId: 'rest-1',
    restaurantName: 'Old Crown Girton',
    headingContext: null,
  }),
}));

import {
  GbpDriftProvider,
  GbpDriftReviewLink,
  GbpDriftStatusPill,
  getGbpDriftNavBadge,
  getGbpDriftSectionBadge,
} from '@/components/features/restaurant-settings/GbpDriftProvider';
import { deriveGbpDriftStatus } from '@/components/features/restaurant-settings/gbpDriftStatus';

import { makeDualSyncHookState } from './testUtils';

const sectionStatus = {
  fieldCount: 3,
  inSyncCount: 1,
  needsReviewCount: 2,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 1,
  driftCount: 1,
};

describe('GbpDriftProvider', () => {
  beforeEach(() => {
    connectionState.data = null;
    connectionState.isLoading = false;
    connectionState.error = null;
    dualSyncState.current = makeDualSyncHookState();
    useOpsDualSync.mockClear();
  });

  it('@smoke renders children within the drift providers', () => {
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <p>Drift-aware content</p>
      </GbpDriftProvider>,
    );

    expect(screen.getByText('Drift-aware content')).toBeInTheDocument();
  });

  it('@contract hides the status pill outside a meaningful drift state', () => {
    // Default context derives from a null restaurant: no pill at all.
    render(<GbpDriftStatusPill />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('@contract shows a Link Google pill when the profile is not connected', () => {
    connectionState.data = { status: 'unlinked' };
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <GbpDriftStatusPill />
      </GbpDriftProvider>,
    );

    const pill = screen.getByRole('link', { name: /GBP/ });
    expect(pill).toHaveTextContent('Link Google');
    expect(pill).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/google-business-profile#gbp-sync-review'),
    );
  });

  it.each([
    { status: 'authorized', externalAccountId: null, externalLocationId: null },
    { status: 'linked', externalAccountId: 'account-1', externalLocationId: null },
    { status: 'linked', externalAccountId: null, externalLocationId: 'location-1' },
    { status: 'unlinked', externalAccountId: 'account-1', externalLocationId: 'location-1' },
  ])(
    '@contract skips dual-sync state until a Google location is linked ($status/$externalAccountId/$externalLocationId)',
    (connection) => {
      connectionState.data = connection;

      render(
        <GbpDriftProvider restaurantId="rest-1">
          <p>Drift-aware content</p>
        </GbpDriftProvider>,
      );

      expect(useOpsDualSync).toHaveBeenCalledWith({ restaurantId: null });
    },
  );

  it('@contract maps drift status kinds to nav badges', () => {
    expect(
      getGbpDriftNavBadge(
        deriveGbpDriftStatus({ restaurantId: null, connection: null, dualSyncState: null }),
      ),
    ).toBeNull();
    expect(
      getGbpDriftNavBadge(
        deriveGbpDriftStatus({
          restaurantId: 'rest-1',
          connection: { status: 'unlinked' } as never,
          dualSyncState: null,
        }),
      ),
    ).toBe('Link');
  });

  it('@contract renders a section review link only when the section needs attention', () => {
    expect(getGbpDriftSectionBadge(sectionStatus)).toBe('2 Google');

    render(
      <GbpDriftProvider restaurantId="rest-1">
        <GbpDriftReviewLink sectionStatus={sectionStatus} />
      </GbpDriftProvider>,
    );
    expect(screen.getByRole('link', { name: /Review in Google workspace/ })).toBeInTheDocument();
  });

  it('@contract renders nothing for a clean section status', () => {
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <GbpDriftReviewLink
          sectionStatus={{ ...sectionStatus, needsReviewCount: 0, pendingCount: 0 }}
        />
      </GbpDriftProvider>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
