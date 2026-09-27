import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/components/features/restaurant-settings/ConfirmDialog';

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete occasion?"
      description="This cannot be undone."
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog', () => {
  it('@contract @a11y renders title and description inside the alert dialog', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete occasion?' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('@contract fires onConfirm when the confirm action is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ confirmLabel: 'Delete occasion' });

    await user.click(screen.getByRole('button', { name: 'Delete occasion' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('@contract closes via onOpenChange when cancel is clicked without confirming', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog({ cancelLabel: 'Keep it' });

    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@smoke renders nothing when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract renders extra body content under the description', () => {
    renderDialog({ children: <p>Bookings on this table move to unassigned.</p> });

    expect(
      within(screen.getByRole('alertdialog')).getByText(
        'Bookings on this table move to unassigned.',
      ),
    ).toBeInTheDocument();
  });

  it('@contract disables only confirm while confirmDisabled', () => {
    renderDialog({ confirmLabel: 'Publish', confirmDisabled: true });

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('@contract disables both actions and shows the pending label while pending', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({
      confirmLabel: 'Delete table',
      pending: true,
      pendingLabel: 'Deleting…',
    });

    const confirm = screen.getByRole('button', { name: 'Deleting…' });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('@contract stays open on confirm when keepOpenOnConfirm is set', async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog({
      confirmLabel: 'Delete table',
      pending: false,
      keepOpenOnConfirm: true,
    });

    await user.click(screen.getByRole('button', { name: 'Delete table' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('@contract closes on confirm by default', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({ confirmLabel: 'Delete table', pending: false });

    await user.click(screen.getByRole('button', { name: 'Delete table' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract pins the title and actions while the description and body scroll (RR6)', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Remove table?"
        description="The table leaves the floor plan."
        onConfirm={vi.fn()}
      >
        <p>Extra detail</p>
      </ConfirmDialog>,
    );

    const dialog = screen.getByRole('alertdialog', { name: 'Remove table?' });
    expect(dialog).toHaveClass('flex', 'flex-col', 'overflow-hidden', 'max-h-[calc(100dvh-2rem)]');
    expect(dialog).toHaveAccessibleDescription('The table leaves the floor plan.');
    const body = dialog.querySelector('[data-slot="confirm-dialog-body"]');
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(body).toContainElement(screen.getByText('Extra detail'));
    expect(body).toContainElement(screen.getByText('The table leaves the floor plan.'));
    expect(screen.getByRole('button', { name: 'Confirm' }).parentElement).toHaveClass('shrink-0');
  });

  it('@contract omits the scrolling body when there is nothing to scroll', () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} title="Sure?" onConfirm={vi.fn()} />);

    expect(
      screen
        .getByRole('alertdialog', { name: 'Sure?' })
        .querySelector('[data-slot="confirm-dialog-body"]'),
    ).toBeNull();
  });
});
