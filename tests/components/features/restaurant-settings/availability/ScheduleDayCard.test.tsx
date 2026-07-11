import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityScheduleDayCard } from '@/components/features/restaurant-settings/availability/ScheduleDayCard';

import { makeDayConfig, makeWeeklyRow } from '../testUtils';

import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { WeeklyRow } from '@/components/features/restaurant-settings/types';

function renderCard(overrides: Partial<Parameters<typeof AvailabilityScheduleDayCard>[0]> = {}) {
  const handlers = {
    onMealTimeChange: vi.fn(),
    onMealToggle: vi.fn(),
    onWeeklyChange: vi.fn(),
  };
  render(
    <AvailabilityScheduleDayCard
      day={makeDayConfig() as DayServiceConfig}
      dayError={undefined}
      hasRequiredOccasions
      row={makeWeeklyRow() as WeeklyRow}
      rowErrors={undefined}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('AvailabilityScheduleDayCard', () => {
  it('@contract renders weekly fields and both meal windows for an open day', () => {
    renderCard();

    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Opens')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('@contract collapses to the closed notice when the day is closed', () => {
    renderCard({
      day: makeDayConfig({ isClosed: true }) as DayServiceConfig,
      row: makeWeeklyRow({ isClosed: true, opensAt: '', closesAt: '' }) as WeeklyRow,
    });

    expect(screen.getByText(/The kitchen is closed on this day/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Opens')).not.toBeInTheDocument();
  });

  it('@contract hides weekly hours or service windows when scoped out', () => {
    renderCard({ showWeeklyHours: false });
    expect(screen.queryByLabelText('Opens')).not.toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('@contract disables meal editors when required occasions are missing', () => {
    renderCard({ hasRequiredOccasions: false });

    for (const toggle of screen.getAllByRole('switch', { name: 'Active' })) {
      expect(toggle).toBeDisabled();
    }
  });
});
