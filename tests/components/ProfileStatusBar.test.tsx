import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfileStatusBar } from '@/components/features/restaurant-settings/profile/ProfileStatusBar';

describe('ProfileStatusBar', () => {
  it('renders the readiness ring with aggregate progress', () => {
    render(
      <ProfileStatusBar
        bookingSlug="old-crown-girton"
        readinessScore={78}
        readinessStageLabel="Almost ready"
        completedCount={7}
        totalCount={9}
        requiredRemainingCount={0}
        nextActionLabel={null}
        nextActionDescription="Required profile fields are complete. You can now polish discovery details."
        googleHint={null}
        googleHref="/app/settings/restaurant/google-business-profile#gbp-connection"
        onJumpToBooking={vi.fn()}
        onJumpToNextAction={null}
      />,
    );

    expect(
      screen.getByRole('img', {
        name: /profile readiness 78%, 7 of 9 fields complete/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('/old-crown-girton')).toBeInTheDocument();
  });

  it('renders one primary CTA for the next required item', async () => {
    const user = userEvent.setup();
    const onJumpToNextAction = vi.fn();

    render(
      <ProfileStatusBar
        bookingSlug={null}
        readinessScore={44}
        readinessStageLabel="In progress"
        completedCount={4}
        totalCount={9}
        requiredRemainingCount={1}
        nextActionLabel="Fix Public booking page URL"
        nextActionDescription="Complete the next required item to make the booking link reliable for guests."
        googleHint="Link Google only when you need import or side-by-side comparison."
        googleHref="/app/settings/restaurant/google-business-profile#gbp-connection"
        onJumpToBooking={vi.fn()}
        onJumpToNextAction={onJumpToNextAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Fix Public booking page URL' }));

    expect(onJumpToNextAction).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Link Google' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );
  });

  it('does not render a Google compare button when compare is handled elsewhere', () => {
    render(
      <ProfileStatusBar
        bookingSlug="old-crown-girton"
        readinessScore={100}
        readinessStageLabel="Launch-ready"
        completedCount={9}
        totalCount={9}
        requiredRemainingCount={0}
        nextActionLabel={null}
        nextActionDescription="Required profile fields are complete. You can now polish discovery details."
        googleHint={null}
        googleHref="/app/settings/restaurant/google-business-profile#gbp-connection"
        onJumpToBooking={vi.fn()}
        onJumpToNextAction={null}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Compare with Google' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Compare with Google' })).not.toBeInTheDocument();
  });
});
