import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncFieldActionToggle } from '@/components/features/restaurant-settings/dual-sync/DualSyncFieldActionToggle';

import type { DualSyncFieldActionAvailability } from '@/components/features/restaurant-settings/dual-sync/dualSyncFieldRowDomain';

const availability = {
  canImport: true,
  canExport: true,
  canIgnore: true,
  isUnsupported: false,
} as unknown as DualSyncFieldActionAvailability;

describe('DualSyncFieldActionToggle', () => {
  it('@contract @a11y selects an action through the labelled toggle group', async () => {
    const user = userEvent.setup();
    const onChangeAction = vi.fn();
    render(
      <DualSyncFieldActionToggle
        availability={availability}
        selectedAction={null}
        disabled={false}
        onChangeAction={onChangeAction}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Import from Google' }));

    expect(onChangeAction).toHaveBeenCalledWith('import_from_google');
  });

  it('@contract clears the action when the active choice is toggled off', async () => {
    const user = userEvent.setup();
    const onChangeAction = vi.fn();
    render(
      <DualSyncFieldActionToggle
        availability={availability}
        selectedAction="ignore"
        disabled={false}
        onChangeAction={onChangeAction}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Ignore field' }));

    expect(onChangeAction).toHaveBeenCalledWith(null);
  });

  it('@contract disables blocked directions independently', () => {
    render(
      <DualSyncFieldActionToggle
        availability={{ ...availability, canExport: false } as DualSyncFieldActionAvailability}
        selectedAction={null}
        disabled={false}
        onChangeAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Send to Google' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Import from Google' })).toBeEnabled();
  });
});
