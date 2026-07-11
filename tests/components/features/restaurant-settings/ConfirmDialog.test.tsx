import { render, screen } from '@testing-library/react';
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
});
