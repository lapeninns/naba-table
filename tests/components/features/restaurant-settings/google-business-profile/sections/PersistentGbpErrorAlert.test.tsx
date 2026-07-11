import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PersistentGbpErrorAlert } from '@/components/features/restaurant-settings/google-business-profile/sections/PersistentGbpErrorAlert';

import type { PersistentGbpError } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileWorkflow';

const error = {
  title: 'Google authorization expired',
  message: 'Reconnect to keep syncing.',
} as unknown as PersistentGbpError;

describe('PersistentGbpErrorAlert', () => {
  it('@smoke renders the error title and message', () => {
    render(<PersistentGbpErrorAlert error={error} />);

    expect(screen.getByText('Google authorization expired')).toBeInTheDocument();
    expect(screen.getByText('Reconnect to keep syncing.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('@contract fires the recovery action and shows its pending label', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const { rerender } = render(
      <PersistentGbpErrorAlert error={error} actionLabel="Reconnect" onAction={onAction} />,
    );

    await user.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(onAction).toHaveBeenCalledTimes(1);

    rerender(
      <PersistentGbpErrorAlert error={error} actionLabel="Reconnect" onAction={onAction} isActionPending />,
    );
    expect(screen.getByRole('button', { name: 'Reconnect...' })).toBeDisabled();
  });
});
