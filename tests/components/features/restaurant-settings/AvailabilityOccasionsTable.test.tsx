import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionsTable } from '@/components/features/restaurant-settings/AvailabilityOccasionsTable';

import type { OpsOccasion } from '@/services/ops/occasions';

function makeOccasion(over: Partial<OpsOccasion> = {}): OpsOccasion {
  return {
    key: 'birthday',
    label: 'Birthday',
    shortLabel: 'Bday',
    description: 'Celebrations',
    defaultDurationMinutes: 90,
    displayOrder: 10,
    isActive: true,
    availability: [{ kind: 'anytime' }],
    ...over,
  } as OpsOccasion;
}

function renderTable(occasions: OpsOccasion[], turnBands?: Parameters<typeof AvailabilityOccasionsTable>[0]['turnBands']) {
  const handlers = { onDelete: vi.fn(), onEdit: vi.fn(), onToggleActive: vi.fn() };
  render(<AvailabilityOccasionsTable occasions={occasions} turnBands={turnBands} {...handlers} />);
  return handlers;
}

describe('AvailabilityOccasionsTable', () => {
  it('@smoke shows the empty state when no occasions exist', () => {
    renderTable([]);

    expect(screen.getByText('No booking types configured yet')).toBeInTheDocument();
  });

  it('@contract renders occasion rows in the desktop table with badges', () => {
    renderTable([
      makeOccasion({ key: 'lunch', label: 'Lunch', isBuiltin: true }),
      makeOccasion(),
    ]);

    // Desktop and mobile markup coexist; scope to the table to avoid duplicates.
    const table = screen.getByRole('table');
    const lunchRow = within(table).getByText('Lunch').closest('tr') as HTMLElement;
    expect(within(lunchRow).getByText('Service window')).toBeInTheDocument();
    expect(within(lunchRow).getByText('Builtin')).toBeInTheDocument();
    expect(within(lunchRow).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('@contract fires edit, delete, and toggle callbacks from a custom occasion row', async () => {
    const user = userEvent.setup();
    const occasion = makeOccasion();
    const { onDelete, onEdit, onToggleActive } = renderTable([occasion]);

    const table = screen.getByRole('table');
    const row = within(table).getByText('Birthday').closest('tr') as HTMLElement;

    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(occasion);

    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(occasion);

    await user.click(within(row).getByRole('switch', { name: 'Toggle Birthday' }));
    expect(onToggleActive).toHaveBeenCalledWith('birthday', false);
  });

  it('@contract mirrors the same occasion into the mobile card list', () => {
    renderTable([makeOccasion()]);

    const mobileSwitch = document.getElementById('occasion-birthday-active-mobile');
    expect(mobileSwitch).not.toBeNull();
    const card = mobileSwitch?.closest('article') as HTMLElement;
    expect(within(card).getByText('Birthday')).toBeInTheDocument();
    expect(within(card).getByText('Dining duration')).toBeInTheDocument();
  });

  it('@contract describes turn bands when provided for the occasion', () => {
    renderTable([makeOccasion()], { birthday: [{ maxPartySize: 4, durationMinutes: 120 }] });

    const table = screen.getByRole('table');
    const row = within(table).getByText('Birthday').closest('tr') as HTMLElement;
    expect(within(row).getByText(/120/)).toBeInTheDocument();
  });
});
