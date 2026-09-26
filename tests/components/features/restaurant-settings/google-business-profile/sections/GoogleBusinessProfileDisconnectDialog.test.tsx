import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GoogleBusinessProfileDisconnectDialog } from '@/components/features/restaurant-settings/google-business-profile/sections/GoogleBusinessProfileDisconnectDialog';

function renderDialog(
  over: Partial<Parameters<typeof GoogleBusinessProfileDisconnectDialog>[0]> = {},
) {
  const handlers = { onOpenChange: vi.fn(), onConfirm: vi.fn() };
  render(<GoogleBusinessProfileDisconnectDialog open isPending={false} {...handlers} {...over} />);
  return handlers;
}

describe('GoogleBusinessProfileDisconnectDialog', () => {
  it('@contract @a11y requires a password before the destructive action arms', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    expect(
      screen.getByRole('alertdialog', { name: 'Disconnect Google Business Profile?' }),
    ).toBeInTheDocument();

    const disconnect = screen.getByRole('button', { name: 'Disconnect' });
    expect(disconnect).toBeDisabled();

    await user.type(screen.getByLabelText('Confirm with your password'), 's3cret ');
    expect(disconnect).toBeEnabled();

    await user.click(disconnect);
    // Password is trimmed before it reaches the handler.
    expect(onConfirm).toHaveBeenCalledWith('s3cret');
  });

  it('@contract locks the form while the disconnect is pending', () => {
    renderDialog({ isPending: true });

    expect(screen.getByLabelText('Confirm with your password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disconnecting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('@contract closes through onOpenChange from cancel', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onConfirm } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
