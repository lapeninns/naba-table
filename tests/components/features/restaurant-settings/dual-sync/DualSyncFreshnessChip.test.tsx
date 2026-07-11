import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncFreshnessChip } from '@/components/features/restaurant-settings/dual-sync/DualSyncFreshnessChip';

// The component accepts `now` explicitly, so freshness is pinned without fake timers.
const NOW = new Date('2026-07-11T12:00:00Z');

describe('DualSyncFreshnessChip', () => {
  it('@contract renders a fresh age with the prefix', () => {
    render(
      <DualSyncFreshnessChip
        timestamp="2026-07-11T11:58:00Z"
        prefix="Verified"
        now={NOW}
      />,
    );

    const chip = screen.getByText(/Verified .*ago/);
    expect(chip.closest('[data-tone]')).toHaveAttribute('data-tone', 'fresh');
  });

  it('@contract falls back to the never label without a timestamp', () => {
    render(<DualSyncFreshnessChip timestamp={null} neverLabel="Never verified" now={NOW} />);

    const chip = screen.getByText('Never verified');
    expect(chip.closest('[data-tone]')).toHaveAttribute('data-tone', 'never');
  });

  it('@contract marks very old timestamps as stale', () => {
    render(<DualSyncFreshnessChip timestamp="2026-05-01T00:00:00Z" now={NOW} />);

    expect(document.querySelector('[data-tone="stale"]')).not.toBeNull();
  });
});
