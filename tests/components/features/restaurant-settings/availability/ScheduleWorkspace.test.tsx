import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleWorkspace } from '@/components/features/restaurant-settings/availability/ScheduleWorkspace';

import { makeDayConfig, makeWeeklyRow } from '../testUtils';

import type { DayServiceConfig } from '@/components/features/restaurant-settings/servicePeriodsMapper';
import type { WeeklyRow } from '@/components/features/restaurant-settings/types';

function renderWorkspace(overrides: Partial<Parameters<typeof ScheduleWorkspace>[0]> = {}) {
  const handlers = {
    onWeeklyChange: vi.fn(),
    onMealToggle: vi.fn(),
    onMealTimeChange: vi.fn(),
    onOverrideChange: vi.fn(),
    onAddOverride: vi.fn(),
    onRemoveOverride: vi.fn(),
  };
  render(
    <ScheduleWorkspace
      weeklyRows={[makeWeeklyRow({ dayOfWeek: 0 }) as WeeklyRow]}
      dayConfigs={[makeDayConfig({ dayOfWeek: 0, label: 'Sunday' }) as DayServiceConfig]}
      weeklyErrors={{}}
      overrideErrors={[]}
      serviceErrors={{}}
      overrideRows={[]}
      hasRequiredOccasions
      occasionKeys={{ lunch: 'lunch', dinner: 'dinner' }}
      operatingHoursDriftFields={[]}
      servicePeriodDriftFields={[]}
      getWeeklyDriftField={() => null}
      customRowsCount={0}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('ScheduleWorkspace', () => {
  it('@smoke renders the save-scope alert and the weekly schedule tab with day cards', () => {
    renderWorkspace();

    expect(screen.getByText('Availability save scope')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Weekly schedule' })).toBeInTheDocument();
    expect(screen.getByText('Sunday')).toBeInTheDocument();
    expect(screen.getByText('Weekly open hours')).toBeInTheDocument();
  });

  it('@contract mentions preserved custom service periods when present', () => {
    renderWorkspace({ customRowsCount: 2 });

    expect(screen.getByText(/2 custom service periods sit outside/)).toBeInTheDocument();
  });

  it('@contract switches to the date overrides tab and adds an override', async () => {
    const user = userEvent.setup();
    const { onAddOverride } = renderWorkspace();

    await user.click(screen.getByRole('tab', { name: 'Date overrides' }));
    expect(await screen.findByText('No date overrides yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add override' }));
    expect(onAddOverride).toHaveBeenCalledTimes(1);
  });

  it('@contract forwards weekly edits from the day card', () => {
    const { onWeeklyChange } = renderWorkspace();

    // jsdom needs whole-value change events for time inputs.
    fireEvent.change(screen.getByLabelText('Opens'), { target: { value: '10:30' } });

    expect(onWeeklyChange).toHaveBeenCalledWith(0, { opensAt: '10:30' });
  });
});
