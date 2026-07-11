import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryStatusFilterPopover } from '@/components/features/email-delivery/components/OpsEmailDeliveryStatusFilterPopover';

describe('OpsEmailDeliveryStatusFilterPopover', () => {
  it('@contract @a11y opens a popover listing every delivery status with per-status counts', async () => {
    const user = userEvent.setup();
    render(
      <OpsEmailDeliveryStatusFilterPopover
        statuses={[]}
        statusCounts={{ delivered: 12, failed: 3 }}
        onToggleStatus={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filter by status' }));

    expect(await screen.findByText('Filter by status', { selector: 'p' })).toBeInTheDocument();
    for (const label of ['Sent', 'Delivered', 'Delayed', 'Bounced', 'Complaint', 'Failed']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('@contract shows the number of active statuses as a badge on the trigger', () => {
    render(
      <OpsEmailDeliveryStatusFilterPopover
        statuses={['failed', 'bounced']}
        statusCounts={null}
        onToggleStatus={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Filter by status' });
    expect(within(trigger).getByText('2')).toBeInTheDocument();
  });

  it('@contract toggles a status on and off through onToggleStatus', async () => {
    const onToggleStatus = vi.fn();
    const user = userEvent.setup();
    render(
      <OpsEmailDeliveryStatusFilterPopover
        statuses={['failed']}
        statusCounts={null}
        onToggleStatus={onToggleStatus}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filter by status' }));

    const failed = await screen.findByRole('checkbox', { name: 'Failed' });
    expect(failed).toBeChecked();
    await user.click(failed);
    expect(onToggleStatus).toHaveBeenCalledWith('failed', false);

    await user.click(screen.getByRole('checkbox', { name: 'Delivered' }));
    expect(onToggleStatus).toHaveBeenCalledWith('delivered', true);
  });
});
