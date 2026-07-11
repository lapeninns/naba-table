import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryForm } from '@/components/features/tables/TableInventoryForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

import type { TableInventory } from '@/services/ops/tables';

const zones = [
  { id: 'zone-main', name: 'Main', active: true },
  { id: 'zone-patio', name: 'Patio', active: true },
];

function makeTable(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: 'table-1',
    restaurantId: 'rest-1',
    tableNumber: '9',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: 'Main Dining',
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'zone-patio',
    zoneName: 'Patio',
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
    table: null,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    isSaving: false,
    zones,
    isZonesLoading: false,
    isFirstTable: false,
    ...overrides,
  };

  // The form renders Radix DialogTitle/DialogFooter, so mount it inside a real
  // dialog the way TableInventoryDialogs does in production.
  const view = render(
    <Dialog open>
      <DialogContent>
        <TableInventoryForm {...props} />
      </DialogContent>
    </Dialog>,
  );

  return { props, ...view };
}

describe('TableInventoryForm', () => {
  it('@contract @a11y titles the dialog for adding versus editing a table', () => {
    const { unmount } = renderForm();
    expect(screen.getByRole('heading', { name: 'Add new table' })).toBeInTheDocument();
    unmount();

    renderForm({ table: makeTable() });
    expect(screen.getByRole('heading', { name: 'Edit table' })).toBeInTheDocument();
    expect(screen.getByLabelText('Table number *')).toHaveValue('9');
  });

  // NOTE: the mount effect defaults the zone draft to the first active zone
  // (covered by buildTableFormDraft in tests/components/tableInventoryDomain.test.ts),
  // but that default is not observable under jsdom: Radix's hidden form-bridge
  // <select> (SelectBubbleInput) dispatches a change event before the native
  // options finish registering, so it re-fires onValueChange('') and stomps the
  // effect's value. Real browsers flush the option-registration layout effects
  // before that passive effect, so production keeps the default. The component
  // suites therefore drive the zone through the UI like an operator would.
  it('@contract submits a parsed payload with the zone picked in the select', async () => {
    const user = userEvent.setup();
    const { props } = renderForm();

    await user.type(screen.getByLabelText('Table number *'), '12');
    await user.click(screen.getByLabelText('Zone'));
    await user.click(await screen.findByRole('option', { name: 'Main' }));
    await user.click(screen.getByRole('button', { name: 'Save table' }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith({
      tableNumber: '12',
      capacity: 4,
      minPartySize: 1,
      maxPartySize: null,
      section: null,
      notes: null,
      zoneId: 'zone-main',
      category: 'dining',
      seatingType: 'standard',
      mobility: 'movable',
      status: 'available',
      active: true,
    });
  });

  it('@contract surfaces a validation error instead of submitting when the party range is inverted', async () => {
    const user = userEvent.setup();
    const { props } = renderForm();

    await user.type(screen.getByLabelText('Table number *'), '12');
    await user.click(screen.getByLabelText('Zone'));
    await user.click(await screen.findByRole('option', { name: 'Main' }));
    await user.clear(screen.getByLabelText('Min party size'));
    await user.type(screen.getByLabelText('Min party size'), '6');
    await user.type(screen.getByLabelText('Max party size'), '2');
    await user.click(screen.getByRole('button', { name: 'Save table' }));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Table was not saved')).toBeInTheDocument();
    expect(
      screen.getByText('Max party size must be greater than or equal to the min party size.'),
    ).toBeInTheDocument();
  });

  it('@contract disables saving while a save is in flight or no zone exists', () => {
    const { unmount } = renderForm({ isSaving: true });
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    unmount();

    renderForm({ zones: [] });
    expect(screen.getByRole('button', { name: 'Save table' })).toBeDisabled();
  });

  it('@contract fires onClose from the cancel button without submitting', async () => {
    const user = userEvent.setup();
    const { props } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('@contract adapts the helper copy for the very first table', () => {
    renderForm({ isFirstTable: true });

    expect(
      screen.getByText(
        'Start with table number and capacity. You can add more zones and advanced details later.',
      ),
    ).toBeInTheDocument();
  });
});
