import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryForm } from '@/components/features/tables/TableInventoryForm';

import type { TableInventory } from '@/services/ops/tables';

const zones = [
  { id: 'zone-main', name: 'Main', active: true },
  { id: 'zone-patio', name: 'Patio', active: false },
];

function makeTable(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: 'table-1',
    restaurantId: 'rest-1',
    tableNumber: '9',
    capacity: 4,
    minPartySize: 2,
    maxPartySize: 4,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'zone-main',
    zoneName: 'Main',
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
    ...overrides,
  };
}

type FormProps = Parameters<typeof TableInventoryForm>[0];

function renderForm(overrides: Partial<FormProps> = {}) {
  const props: FormProps = {
    open: true,
    onOpenChange: vi.fn(),
    table: null,
    onSubmit: vi.fn(),
    isSaving: false,
    zones,
    isZonesLoading: false,
    ...overrides,
  };
  render(<TableInventoryForm {...props} />);
  return { props, dialog: screen.getByRole('dialog') };
}

describe('TableInventoryForm', () => {
  it('labels the add dialog and its fields in plain words', () => {
    const { dialog } = renderForm();

    expect(within(dialog).getByRole('heading', { name: 'Add table' })).toBeInTheDocument();
    expect(within(dialog).getByText('Saves as soon as you select Save table.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Table number')).toHaveValue('');
    expect(within(dialog).getByLabelText('Seats')).toHaveValue(4);
    expect(within(dialog).getByText('1 to 20.')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('group', { name: 'Party sizes this table accepts' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Largest party')).toHaveAttribute(
      'placeholder',
      'Same as seats',
    );
    expect(within(dialog).getByRole('combobox', { name: 'Zone' })).toHaveTextContent('Main');
    expect(within(dialog).getByRole('switch', { name: 'Can be given to bookings' })).toBeChecked();
  });

  it('keeps details and service notes behind a disclosure with allocation hints', async () => {
    const user = userEvent.setup();
    const { dialog } = renderForm();

    const disclosure = within(dialog).getByRole('button', { name: /Details and service notes/ });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');

    expect(
      within(dialog).getByRole('combobox', { name: 'Service status' }),
    ).toHaveAccessibleDescription(
      'Only “Out of service” stops bookings being assigned. The others are for your notes.',
    );
    expect(within(dialog).getByRole('combobox', { name: 'Can it be moved?' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Seating, category and section are for your records and don’t change which bookings a table gets.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Notes')).toHaveAttribute('maxLength', '500');
  });

  it('opens the disclosure for an out-of-service table and submits every field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { dialog } = renderForm({
      table: makeTable({ status: 'out_of_service', notes: 'Wobbly leg', section: 'Window' }),
      onSubmit,
    });

    expect(within(dialog).getByRole('heading', { name: 'Edit table 9' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /Details and service notes/ }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(within(dialog).getByRole('button', { name: 'Save table' }));

    expect(onSubmit).toHaveBeenCalledWith({
      tableNumber: '9',
      capacity: 4,
      minPartySize: 2,
      maxPartySize: 4,
      section: 'Window',
      notes: 'Wobbly leg',
      zoneId: 'zone-main',
      category: 'dining',
      seatingType: 'standard',
      mobility: 'movable',
      status: 'out_of_service',
      active: true,
    });
  });

  it('shows field errors below the fields and focuses the first one', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { dialog } = renderForm({ onSubmit });

    const seats = within(dialog).getByLabelText('Seats');
    await user.clear(seats);
    await user.type(seats, '25');
    await user.type(within(dialog).getByLabelText('Largest party'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Save table' }));

    const number = within(dialog).getByLabelText('Table number');
    expect(within(dialog).getByText('Enter a table number')).toBeInTheDocument();
    expect(number).toHaveAttribute('aria-invalid', 'true');
    expect(number).toHaveAccessibleDescription('Enter a table number');
    expect(seats).toHaveAccessibleDescription('1 to 20. Enter seats from 1 to 20');
    expect(
      within(dialog).getByText('Largest party must be at least the smallest party, up to 20'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(number).toHaveFocus());
  });

  it('shows the server duplicate-number error on the table number field', () => {
    const { dialog } = renderForm({ tableNumberError: 'Table 9 already exists' });

    const number = within(dialog).getByLabelText('Table number');
    expect(number).toHaveAttribute('aria-invalid', 'true');
    expect(number).toHaveAccessibleDescription('Table 9 already exists');
  });

  it('notes when the chosen zone is out of service', () => {
    const { dialog } = renderForm({ table: makeTable({ zoneId: 'zone-patio' }) });
    expect(
      within(dialog).getByText(
        'This zone is out of service, so its tables can’t be booked until it is back in service.',
      ),
    ).toBeInTheDocument();
  });

  it('disables saving while a save is in flight and cancels without saving', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderForm({ isSaving: true, onOpenChange });

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
