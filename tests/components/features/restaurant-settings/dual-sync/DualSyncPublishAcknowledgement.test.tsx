import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishAcknowledgement } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishAcknowledgement';

describe('DualSyncPublishAcknowledgement', () => {
  it('@contract @a11y exposes the labelled acknowledgement checkbox and reports changes', async () => {
    const user = userEvent.setup();
    const onAcknowledgedChange = vi.fn();
    render(
      <DualSyncPublishAcknowledgement
        acknowledged={false}
        onAcknowledgedChange={onAcknowledgedChange}
      />,
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /I understand this may update public Google Business Profile data\./,
    });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onAcknowledgedChange).toHaveBeenCalledWith(true);
  });

  it('@contract renders the checked state', () => {
    render(<DualSyncPublishAcknowledgement acknowledged onAcknowledgedChange={vi.fn()} />);

    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
