import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityOccasionsEditor } from '@/components/features/restaurant-settings/AvailabilityOccasionsEditor';

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

function renderEditor(occasions: OpsOccasion[] = [makeOccasion()]) {
  const onChange = vi.fn();
  render(<AvailabilityOccasionsEditor occasions={occasions} onChange={onChange} />);
  return { onChange };
}

describe('AvailabilityOccasionsEditor', () => {
  it('@smoke renders the booking types section with its create action', () => {
    renderEditor();

    expect(screen.getByText('Booking types')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New booking type' })).toBeInTheDocument();
  });

  it('@contract blocks create submission with validation errors for empty key and label', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'New booking type' }));
    const dialog = await screen.findByRole('dialog', { name: 'New booking type' });
    await user.click(within(dialog).getByRole('button', { name: 'Add occasion' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(within(dialog).getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
  });

  it('@contract creates a booking type and emits the extended list', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    await user.click(screen.getByRole('button', { name: 'New booking type' }));
    const dialog = await screen.findByRole('dialog', { name: 'New booking type' });
    await user.type(within(dialog).getByLabelText('Key'), 'anniversary');
    await user.type(within(dialog).getByLabelText('Label'), 'Anniversary');
    await user.click(within(dialog).getByRole('button', { name: 'Add occasion' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as OpsOccasion[];
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ key: 'anniversary', label: 'Anniversary' });
  });

  it('@contract toggles an occasion active state in place', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('switch', { name: 'Toggle Birthday' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ key: 'birthday', isActive: false })]);
  });

  it('@contract deletes a custom occasion only after confirmation', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor();

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Delete' }));

    const confirm = await screen.findByRole('alertdialog', { name: 'Delete occasion?' });
    expect(onChange).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole('button', { name: 'Delete occasion' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
