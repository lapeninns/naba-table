import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GoogleBusinessProfileSyncActionDialog } from '@/src/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSyncActionDialog';

describe('GoogleBusinessProfileSyncActionDialog', () => {
  it('requires both a password and at least one selected item before confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <GoogleBusinessProfileSyncActionDialog
        open
        onOpenChange={vi.fn()}
        title="Import profile fields"
        description="Confirm the fields to import."
        confirmLabel="Import selected fields"
        items={[
          {
            id: 'name',
            label: 'Business name',
            defaultChecked: true,
          },
          {
            id: 'address',
            label: 'Address',
            defaultChecked: false,
          },
        ]}
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', {
      name: /import selected fields/i,
    });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/confirm with your login password/i), 'secret');
    expect(confirmButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByLabelText(/address/i));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith({
      password: 'secret',
      selectedIds: ['address'],
    });
  });
});
