import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleDayCardHeader } from '@/components/features/restaurant-settings/availability/ScheduleDayCardHeader';

import { makeWeeklyRow } from '../testUtils';

import type { WeeklyRow } from '@/components/features/restaurant-settings/types';

function renderHeader(overrides: Partial<Parameters<typeof ScheduleDayCardHeader>[0]> = {}) {
  const onWeeklyChange = vi.fn();
  const row = makeWeeklyRow() as WeeklyRow;
  render(
    <ScheduleDayCardHeader
      dayLabel="Monday"
      isClosed={false}
      onWeeklyChange={onWeeklyChange}
      row={row}
      serviceDriftFields={[]}
      weeklyDriftField={null}
      {...overrides}
    />,
  );
  return { onWeeklyChange, row };
}

describe('ScheduleDayCardHeader', () => {
  it('@smoke shows the day label with an Open badge when trading', () => {
    renderHeader();

    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('@smoke shows the Closed badge for closed days', () => {
    renderHeader({ isClosed: true });

    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('@contract closing the day clears its open and close times', async () => {
    const user = userEvent.setup();
    const { onWeeklyChange, row } = renderHeader();

    await user.click(screen.getByRole('switch', { name: 'Open day' }));

    expect(onWeeklyChange).toHaveBeenCalledWith(row.dayOfWeek, {
      isClosed: true,
      opensAt: '',
      closesAt: '',
    });
  });

  it('@contract reopening the day keeps the remembered times', async () => {
    const user = userEvent.setup();
    const { onWeeklyChange, row } = renderHeader({ isClosed: true });

    await user.click(screen.getByRole('switch', { name: 'Open day' }));

    expect(onWeeklyChange).toHaveBeenCalledWith(row.dayOfWeek, {
      isClosed: false,
      opensAt: row.opensAt,
      closesAt: row.closesAt,
    });
  });
});
