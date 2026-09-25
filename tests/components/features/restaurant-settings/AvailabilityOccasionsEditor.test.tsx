import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AvailabilityOccasionsEditor,
  describeTableTimes,
} from '@/components/features/restaurant-settings/AvailabilityOccasionsEditor';

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
    isBuiltin: false,
    availability: [{ kind: 'anytime' }],
    ...over,
  } as OpsOccasion;
}

function renderEditor(occasions: OpsOccasion[] = [makeOccasion()]) {
  const onChange = vi.fn();
  const onTurnBandsChange = vi.fn();
  render(
    <AvailabilityOccasionsEditor
      occasions={occasions}
      savedOccasions={occasions}
      savedTurnBands={{}}
      turnBands={{}}
      onChange={onChange}
      onTurnBandsChange={onTurnBandsChange}
    />,
  );
  return { onChange, onTurnBandsChange };
}

describe('AvailabilityOccasionsEditor', () => {
  it('@smoke lists each booking type with its table time and availability', () => {
    renderEditor([makeOccasion(), makeOccasion({ key: 'lunch', label: 'Lunch', isBuiltin: true })]);

    expect(screen.getByRole('button', { name: 'Add booking type' })).toBeInTheDocument();
    expect(screen.getByText('Required for meal times')).toBeInTheDocument();
    expect(screen.getAllByText('all party sizes 90 min')).toHaveLength(2);
    expect(screen.getAllByText('Always available')).toHaveLength(2);
    // Built-in booking types cannot be removed.
    expect(screen.queryByRole('button', { name: 'Remove Lunch' })).not.toBeInTheDocument();
  });

  it('@contract blocks adding a booking type without a name', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add booking type' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add booking type' });
    await user.click(within(dialog).getByRole('button', { name: 'Add booking type' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('@contract suggests the key from the name and adds the booking type to the draft', async () => {
    const user = userEvent.setup();
    const { onChange, onTurnBandsChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add booking type' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add booking type' });
    await user.type(within(dialog).getByLabelText('Name'), 'Afternoon tea');
    await user.click(within(dialog).getByRole('button', { name: 'Add booking type' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]![0] as OpsOccasion[];
    expect(next[1]).toMatchObject({ key: 'afternoon_tea', label: 'Afternoon tea' });
    expect(onTurnBandsChange).toHaveBeenCalledWith('afternoon_tea', []);
  });

  it('@contract rejects a key that is already used', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Add booking type' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add booking type' });
    await user.type(within(dialog).getByLabelText('Name'), 'Birthday');
    await user.click(within(dialog).getByRole('button', { name: 'Add booking type' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(within(dialog).getByText('This key is already used')).toBeInTheDocument();
  });

  it('@contract switches a booking type on or off in place', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(screen.getByRole('switch', { name: 'Birthday available to book' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'birthday', isActive: false }),
    ]);
  });

  it('@contract removes a custom booking type only after confirmation', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'Remove Birthday' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Remove Birthday?' });
    expect(confirm).toHaveTextContent('Existing bookings keep their type.');
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole('button', { name: 'Remove booking type' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('describeTableTimes', () => {
  it('describes bands, with larger groups taking the last band as the server does', () => {
    expect(
      describeTableTimes(
        [
          { maxPartySize: 2, durationMinutes: 75 },
          { maxPartySize: 4, durationMinutes: 90 },
        ],
        undefined,
        120,
      ),
    ).toBe('1–2 guests 75 min · 3–4 guests 90 min · larger groups 90 min');
  });

  it('marks Nabatable’s built-in bands when a type has none of its own', () => {
    expect(describeTableTimes([], [{ maxPartySize: 1, durationMinutes: 60 }], 90)).toBe(
      '1 guests 60 min · larger groups 60 min (Nabatable default)',
    );
  });
});
