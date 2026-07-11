import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ActionButtonRow,
  GhostButton,
  PrimaryButtonLink,
  SecondaryButton,
  SummaryActions,
} from '@/components/features/booking/ui/BookingActionComponents';

describe('BookingActionComponents', () => {
  it('@smoke renders children inside the row and summary layout wrappers', () => {
    render(
      <>
        <ActionButtonRow>
          <span>row child</span>
        </ActionButtonRow>
        <SummaryActions>
          <span>summary child</span>
        </SummaryActions>
      </>,
    );

    expect(screen.getByText('row child')).toBeInTheDocument();
    expect(screen.getByText('summary child')).toBeInTheDocument();
  });

  it('@contract @a11y renders PrimaryButtonLink as a link with the given href and accessible name', () => {
    render(<PrimaryButtonLink href="/guest/bookings/abc">Manage booking</PrimaryButtonLink>);

    const link = screen.getByRole('link', { name: 'Manage booking' });
    expect(link).toHaveAttribute('href', '/guest/bookings/abc');
  });

  it('@contract fires SecondaryButton onClick and blocks clicks when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(<SecondaryButton onClick={onClick}>Share</SecondaryButton>);

    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <SecondaryButton onClick={onClick} disabled>
        Share
      </SecondaryButton>,
    );

    expect(screen.getByRole('button', { name: 'Share' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('@contract fires GhostButton onClick and blocks clicks when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(<GhostButton onClick={onClick}>Book Again</GhostButton>);

    await user.click(screen.getByRole('button', { name: 'Book Again' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <GhostButton onClick={onClick} disabled>
        Book Again
      </GhostButton>,
    );

    expect(screen.getByRole('button', { name: 'Book Again' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Book Again' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
