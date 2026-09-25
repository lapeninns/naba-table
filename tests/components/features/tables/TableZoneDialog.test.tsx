import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableZoneDialog } from '@/components/features/tables/TableZoneDialog';

type ZoneDialogProps = Parameters<typeof TableZoneDialog>[0];

const zones = [
  { id: 'zone-main', name: 'Main dining room' },
  { id: 'zone-bar', name: 'Bar' },
];

function renderDialog(overrides: Partial<ZoneDialogProps> = {}) {
  const props: ZoneDialogProps = {
    editingZone: null,
    zones,
    isSaving: false,
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<TableZoneDialog {...props} />);
  return { props, dialog: screen.getByRole('dialog') };
}

describe('TableZoneDialog', () => {
  it('requires a zone name with a visible error', async () => {
    const user = userEvent.setup();
    const { dialog, props } = renderDialog();

    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));

    const name = within(dialog).getByLabelText('Zone name');
    expect(within(dialog).getByText('Enter a zone name')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Enter a zone name');
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a name another zone already uses', async () => {
    const user = userEvent.setup();
    const { dialog, props } = renderDialog();

    await user.type(within(dialog).getByLabelText('Zone name'), 'bar');
    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));

    expect(within(dialog).getByText('A zone with this name already exists')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('adds a new zone at the end by default', async () => {
    const user = userEvent.setup();
    const { dialog, props } = renderDialog();

    expect(
      within(dialog).getByRole('combobox', { name: 'Position on this page' }),
    ).toHaveTextContent('At the end');
    await user.type(within(dialog).getByLabelText('Zone name'), ' Terrace ');
    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Terrace', beforeZoneId: null });
  });

  it('continues to the table when opened from Add table with no zones', () => {
    const { dialog } = renderDialog({ continuesToTable: true });

    expect(
      within(dialog).getByText('Tables belong to a zone. Add one, then add your table.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Add zone and continue' }),
    ).toBeInTheDocument();
  });

  it('edits an existing zone and keeps its position', async () => {
    const user = userEvent.setup();
    const { dialog, props } = renderDialog({
      editingZone: { id: 'zone-main', name: 'Main dining room', active: true, sortOrder: 0 },
    });

    expect(
      within(dialog).getByRole('heading', { name: 'Edit Main dining room' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Zone name')).toHaveValue('Main dining room');
    expect(
      within(dialog).getByRole('combobox', { name: 'Position on this page' }),
    ).toHaveTextContent('Before Bar');
    await user.click(within(dialog).getByRole('button', { name: 'Save zone' }));
    expect(props.onSubmit).toHaveBeenCalledWith({
      name: 'Main dining room',
      beforeZoneId: 'zone-bar',
    });
  });

  it('shows a saving state that cannot be pressed twice', () => {
    renderDialog({ isSaving: true });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
