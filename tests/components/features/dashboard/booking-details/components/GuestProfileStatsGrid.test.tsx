import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestProfileStatsGrid } from '@/components/features/dashboard/booking-details/components/GuestProfileStatsGrid';

function renderGrid(overrides: Partial<Parameters<typeof GuestProfileStatsGrid>[0]> = {}) {
  return render(
    <GuestProfileStatsGrid
      formattedStartTime="18:00"
      durationMinutes={90}
      partySize={4}
      occasionLabel="birthday"
      depositLabel="£50.00"
      sourceLabel="web"
      {...overrides}
    />,
  );
}

describe('GuestProfileStatsGrid', () => {
  it('@contract renders every stat chip with its value', () => {
    renderGrid();

    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText('4 guests')).toBeInTheDocument();
    expect(screen.getByText('birthday')).toBeInTheDocument();
    expect(screen.getByText('£50.00')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
  });

  it('@contract formats sub-hour durations in minutes only', () => {
    renderGrid({ durationMinutes: 45 });

    expect(screen.getByText('45m')).toBeInTheDocument();
  });

  it('@contract omits duration and falls back to None without deposit', () => {
    renderGrid({ durationMinutes: null, depositLabel: null });

    expect(screen.queryByText(/\dh /)).not.toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });
});
