import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmationDialog } from '@/components/features/booking-state-machine/ConfirmationDialog';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('ConfirmationDialog', () => {
  it('keeps the dialog open until an async confirmation resolves', async () => {
    const user = userEvent.setup();
    const confirm = deferred();
    const onConfirm = vi.fn(() => confirm.promise);
    const onAfterClose = vi.fn();

    render(
      <ConfirmationDialog
        trigger={<button type="button">Open dialog</button>}
        title="Confirm action?"
        description="Confirm this action."
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        onAfterClose={onAfterClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onAfterClose).not.toHaveBeenCalled();

    confirm.resolve();

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(onAfterClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the dialog open and skips cleanup when confirmation fails', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Mutation failed'));
    const onAfterClose = vi.fn();

    render(
      <ConfirmationDialog
        trigger={<button type="button">Open dialog</button>}
        title="Confirm action?"
        description="Confirm this action."
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        onAfterClose={onAfterClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onAfterClose).not.toHaveBeenCalled();
  });
});
