import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DualSyncFieldFreshnessIndicator } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldFreshnessIndicator';

describe('DualSyncFieldFreshnessIndicator', () => {
  beforeEach(() => {
    // The indicator forwards to the freshness chip without a `now` override, so pin time.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-11T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract renders nothing without a freshness descriptor', () => {
    const { container } = render(<DualSyncFieldFreshnessIndicator freshness={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract renders the chip from the descriptor', () => {
    render(
      <DualSyncFieldFreshnessIndicator
        freshness={{
          timestamp: '2026-07-11T11:59:00Z',
          prefix: 'In sync',
          neverLabel: 'Never in sync',
        }}
      />,
    );

    expect(screen.getByText(/In sync .*ago/)).toBeInTheDocument();
  });
});
