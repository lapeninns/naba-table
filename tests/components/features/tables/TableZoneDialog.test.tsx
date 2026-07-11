import { render, screen } from '@testing-library/react';
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

  const view = render(<TableZoneDialog {...props} />);
  return { props, ...view };
}

describe('TableZoneDialog', () => {
  it('@contract stays unmounted while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('@contract @a11y titles the dialog for adding versus editing a zone', () => {
    const { unmount } = renderDialog();
    expect(screen.getByRole('heading', { name: 'Add zone' })).toBeInTheDocument();
    unmount();

    renderDialog({
      editingZone: { id: 'zone-1', name: 'Terrace', active: true, sortOrder: 3 },
    });
    expect(screen.getByRole('heading', { name: 'Edit zone' })).toBeInTheDocument();
    expect(screen.getByLabelText('Zone name *')).toHaveValue('Terrace');
    expect(screen.getByLabelText('Sort order')).toHaveValue(3);
  });

  it('@contract submits the trimmed zone name and parsed sort order', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.type(screen.getByLabelText('Zone name *'), '  Garden  ');
    await user.clear(screen.getByLabelText('Sort order'));
    await user.type(screen.getByLabelText('Sort order'), '5');
    await user.click(screen.getByRole('button', { name: 'Save zone' }));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Garden', sortOrder: 5 });
  });

  it('@contract omits the sort order when the field is left empty', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.type(screen.getByLabelText('Zone name *'), 'Garden');
    await user.clear(screen.getByLabelText('Sort order'));
    await user.click(screen.getByRole('button', { name: 'Save zone' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Garden' });
  });

  it('@contract disables the save button while saving', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('@contract closes via the cancel button without submitting', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});
