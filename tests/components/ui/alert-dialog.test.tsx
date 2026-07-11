import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function renderAlertDialog(onAction = vi.fn()) {
  render(
    <AlertDialog>
      <AlertDialogTrigger>Delete table</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onAction}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );
  return { onAction };
}

describe('ui/alert-dialog', () => {
  it('@smoke stays closed until the trigger is clicked', () => {
    renderAlertDialog();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract @a11y opens a titled alertdialog from the trigger', async () => {
    const user = userEvent.setup();
    renderAlertDialog();

    await user.click(screen.getByRole('button', { name: 'Delete table' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Are you sure?' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('@contract cancel closes without firing the action; action fires and closes', async () => {
    const user = userEvent.setup();
    const { onAction } = renderAlertDialog();

    await user.click(screen.getByRole('button', { name: 'Delete table' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete table' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract action and cancel reuse the button variant styles', async () => {
    const user = userEvent.setup();
    renderAlertDialog();

    await user.click(screen.getByRole('button', { name: 'Delete table' }));

    expect(await screen.findByRole('button', { name: 'Confirm' })).toHaveClass(
      'bg-primary',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('border');
  });
});
