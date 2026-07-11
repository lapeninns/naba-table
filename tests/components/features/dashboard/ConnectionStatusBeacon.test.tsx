import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import { ConnectionStatusBeacon } from '@/components/features/dashboard/ConnectionStatusBeacon';

import { PINNED_NOW_ISO } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

const PINNED_NOW_MS = Date.parse(PINNED_NOW_ISO);

describe('ConnectionStatusBeacon', () => {
  beforeEach(() => {
    // BookingListClient pattern: pinned clock keeps status derivation
    // deterministic on any host date/TZ.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(PINNED_NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract shows Initializing while no data timestamp exists', () => {
    render(<ConnectionStatusBeacon initialNowIso={PINNED_NOW_ISO} />);

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Connection status: Initializing. Sync: Realtime.',
    );
    expect(screen.getAllByText('Updating…').length).toBeGreaterThanOrEqual(1);
  });

  it('@contract shows Live with a relative updated label for fresh data', () => {
    render(
      <ConnectionStatusBeacon
        initialNowIso={PINNED_NOW_ISO}
        dataUpdatedAt={PINNED_NOW_MS - 10_000}
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Connection status: Live. Sync: Realtime.',
    );
    expect(screen.getByText(/Bookings updated/)).toBeInTheDocument();
  });

  it('@contract flips to Stale once the data timestamp exceeds the stale window', () => {
    render(
      <ConnectionStatusBeacon
        initialNowIso={PINNED_NOW_ISO}
        dataUpdatedAt={PINNED_NOW_MS - 400_000}
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Connection status: Stale. Sync: Realtime.',
    );
  });

  it('@contract shows Error when the summary failed and no data has arrived', () => {
    render(<ConnectionStatusBeacon initialNowIso={PINNED_NOW_ISO} hasSummaryError />);

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Connection status: Error. Sync: Realtime.',
    );
  });

  it('@contract error state is ignored once data exists (data wins over the error flag)', () => {
    render(
      <ConnectionStatusBeacon
        initialNowIso={PINNED_NOW_ISO}
        dataUpdatedAt={PINNED_NOW_MS - 5_000}
        hasSummaryError
      />,
    );

    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Connection status: Live. Sync: Realtime.',
    );
  });

  it('@contract reports Polling when realtime is disabled or unhealthy or explicitly polling', () => {
    const { rerender } = render(
      <ConnectionStatusBeacon initialNowIso={PINNED_NOW_ISO} realtimeEnabled={false} />,
    );
    expect(screen.getByRole('status')).toHaveAccessibleName(/Sync: Polling\./);

    rerender(<ConnectionStatusBeacon initialNowIso={PINNED_NOW_ISO} realtimeHealthy={false} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/Sync: Polling\./);

    rerender(<ConnectionStatusBeacon initialNowIso={PINNED_NOW_ISO} isPolling={false} />);
    expect(screen.getByRole('status')).toHaveAccessibleName(/Sync: Realtime\./);
  });

  it('@a11y exposes the beacon as a polite live region', () => {
    render(<ConnectionStatusBeacon initialNowIso={PINNED_NOW_ISO} />);

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
    expect(statusRegion).toHaveAttribute('aria-atomic', 'true');
  });
});
