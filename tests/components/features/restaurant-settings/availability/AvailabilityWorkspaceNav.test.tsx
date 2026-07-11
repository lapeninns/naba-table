import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityWorkspaceNav } from '@/components/features/restaurant-settings/availability/AvailabilityWorkspaceNav';

describe('AvailabilityWorkspaceNav', () => {
  it('@smoke @a11y lists the three availability workspaces as selectable items', () => {
    render(<AvailabilityWorkspaceNav activeWorkspace="schedule" onSelectWorkspace={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Booking rules/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Booking types/ })).toBeInTheDocument();
  });

  it('@contract @a11y marks only the active workspace with aria-current', () => {
    render(<AvailabilityWorkspaceNav activeWorkspace="rules" onSelectWorkspace={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Booking rules/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: /Booking types/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('@contract selects a workspace when its nav item is clicked', async () => {
    const user = userEvent.setup();
    const onSelectWorkspace = vi.fn();
    render(
      <AvailabilityWorkspaceNav activeWorkspace="rules" onSelectWorkspace={onSelectWorkspace} />,
    );

    await user.click(screen.getByRole('button', { name: /Booking types/ }));

    expect(onSelectWorkspace).toHaveBeenCalledWith('booking-types');
  });

  it('@contract renders the availability badge on the schedule item', () => {
    render(
      <AvailabilityWorkspaceNav
        activeWorkspace="schedule"
        availabilityBadge="2 Google"
        onSelectWorkspace={vi.fn()}
      />,
    );

    expect(screen.getByText('2 Google')).toBeInTheDocument();
  });
});
