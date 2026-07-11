import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOverridesEditor } from '@/components/features/restaurant-settings/AvailabilityOverridesEditor';

import type { OverrideRow } from '@/components/features/restaurant-settings/types';

function makeRow(over: Partial<OverrideRow> = {}): OverrideRow {
  return {
    id: 'override-1',
    effectiveDate: '2026-12-24',
    opensAt: '12:00',
    closesAt: '20:00',
    isClosed: false,
    notes: 'Christmas Eve',
    reservationIntervalMinutes: '30',
    reservationSlotTimes: '',
    ...over,
  };
}

function renderEditor(rows: OverrideRow[], rowErrors: Parameters<typeof AvailabilityOverridesEditor>[0]['rowErrors'] = []) {
  const handlers = { onAdd: vi.fn(), onChange: vi.fn(), onRemove: vi.fn() };
  render(<AvailabilityOverridesEditor rows={rows} rowErrors={rowErrors} {...handlers} />);
  return handlers;
}

describe('AvailabilityOverridesEditor', () => {
  it('@smoke shows the empty state when no overrides exist', () => {
    renderEditor([]);

    expect(screen.getByText('No date overrides yet')).toBeInTheDocument();
  });

  it('@contract fires onAdd from the Add override action', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderEditor([]);

    await user.click(screen.getByRole('button', { name: 'Add override' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('@contract patches the row when opening time is edited', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([makeRow()]);

    const opens = screen.getByLabelText('Opens');
    await user.clear(opens);

    expect(onChange).toHaveBeenLastCalledWith(0, { opensAt: '' });
  });

  it('@contract toggles the closed flag through the Open switch', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor([makeRow()]);

    await user.click(screen.getByRole('switch', { name: 'Open' }));

    expect(onChange).toHaveBeenCalledWith(0, { isClosed: true });
  });

  it('@contract disables time and interval inputs while the date is marked closed', () => {
    renderEditor([makeRow({ isClosed: true })]);

    expect(screen.getByLabelText('Opens')).toBeDisabled();
    expect(screen.getByLabelText('Closes')).toBeDisabled();
    expect(screen.getByLabelText('Interval (min)')).toBeDisabled();
    expect(screen.getByLabelText('Slot times')).toBeDisabled();
    // Notes stay editable even when closed.
    expect(screen.getByLabelText('Notes')).toBeEnabled();
  });

  it('@contract renders per-row validation errors', () => {
    renderEditor(
      [makeRow(), makeRow({ id: 'override-2', effectiveDate: '2026-12-25' })],
      [{}, { opensAt: 'Enter an opening time', closesAt: 'Enter a closing time' }],
    );

    const second = screen.getByText('Override 2').closest('div[class*="rounded-xl"]');
    expect(second).not.toBeNull();
    expect(within(second as HTMLElement).getByText('Enter an opening time')).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText('Enter a closing time')).toBeInTheDocument();
  });
});
