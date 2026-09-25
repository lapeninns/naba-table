import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableZoneDialog } from '@/components/features/tables/TableZoneDialog';

type ZoneDialogProps = Parameters<typeof TableZoneDialog>[0];

function renderDialog(overrides: Partial<ZoneDialogProps> = {}) {
  const props: ZoneDialogProps = {
    editingZone: null,
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

  it('submits the name and order', async () => {
    const user = userEvent.setup();
    const { dialog, props } = renderDialog({ nextSortOrder: 3 });

    expect(within(dialog).getByLabelText('Order in lists')).toHaveValue(3);
    await user.type(within(dialog).getByLabelText('Zone name'), ' Terrace ');
    await user.click(within(dialog).getByRole('button', { name: 'Add zone' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Terrace', sortOrder: 3 });
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

  it('edits an existing zone', async () => {
    const user = userEvent.setup();
    const { dialog, props } = renderDialog({
      editingZone: { id: 'zone-1', name: 'Bar', active: true, sortOrder: 2 },
    });

    expect(within(dialog).getByRole('heading', { name: 'Edit zone' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Zone name')).toHaveValue('Bar');
    await user.click(within(dialog).getByRole('button', { name: 'Save zone' }));
    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Bar', sortOrder: 2 });
  });

  it('shows a saving state that cannot be pressed twice', () => {
    renderDialog({ isSaving: true });
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });
});
