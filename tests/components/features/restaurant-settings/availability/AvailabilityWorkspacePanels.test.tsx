import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

// The four workspace cards are hook-heavy clients with their own suites; this
// test pins the panel visibility contract, so stub them with markers.
vi.mock('@/components/features/restaurant-settings/availability/BookingRulesCard', () => ({
  BookingRulesCard: () => <div data-testid="booking-rules-card" />,
}));
vi.mock('@/components/features/restaurant-settings/availability/BookingTypesCard', () => ({
  BookingTypesCard: () => <div data-testid="booking-types-card" />,
}));
vi.mock('@/components/features/restaurant-settings/availability/DateOverridesCard', () => ({
  DateOverridesCard: () => <div data-testid="date-overrides-card" />,
}));
vi.mock('@/components/features/restaurant-settings/availability/ServiceWindowsCard', () => ({
  ServiceWindowsCard: () => <div data-testid="service-windows-card" />,
}));
vi.mock('@/components/features/restaurant-settings/availability/WeeklyScheduleCard', () => ({
  WeeklyScheduleCard: () => <div data-testid="weekly-schedule-card" />,
}));

import { AvailabilityWorkspacePanels } from '@/components/features/restaurant-settings/availability/AvailabilityWorkspacePanels';

function panelOf(testId: string) {
  return screen.getByTestId(testId).closest('[aria-hidden]') as HTMLElement;
}

describe('AvailabilityWorkspacePanels', () => {
  it('@contract shows only the schedule cards when the schedule workspace is active', () => {
    render(
      <AvailabilityWorkspacePanels
        activeWorkspace="schedule"
        restaurantId="rest-1"
        reduceMotion
      />,
    );

    expect(panelOf('weekly-schedule-card')).toHaveAttribute('aria-hidden', 'false');
    expect(panelOf('service-windows-card')).toHaveAttribute('aria-hidden', 'false');
    expect(panelOf('date-overrides-card')).toHaveAttribute('aria-hidden', 'false');
    expect(panelOf('booking-rules-card')).toHaveAttribute('aria-hidden', 'true');
    expect(panelOf('booking-types-card')).toHaveAttribute('aria-hidden', 'true');
  });

  it('@contract shows the booking rules panel for the rules workspace', () => {
    render(
      <AvailabilityWorkspacePanels activeWorkspace="rules" restaurantId="rest-1" reduceMotion />,
    );

    expect(panelOf('booking-rules-card')).toHaveAttribute('aria-hidden', 'false');
    expect(panelOf('weekly-schedule-card')).toHaveAttribute('aria-hidden', 'true');
  });

  it('@contract shows the booking types panel for the booking-types workspace', () => {
    render(
      <AvailabilityWorkspacePanels
        activeWorkspace="booking-types"
        restaurantId="rest-1"
        reduceMotion
      />,
    );

    expect(panelOf('booking-types-card')).toHaveAttribute('aria-hidden', 'false');
    expect(panelOf('booking-rules-card')).toHaveAttribute('aria-hidden', 'true');
  });
});
