import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  BookingDialogLayout,
  BookingDialogShell,
} from '@/components/features/dashboard/booking-details/components/BookingDialogShell';

describe('BookingDialogShell', () => {
  it('@contract renders the desktop dialog with an accessible title and body content', () => {
    render(
      <BookingDialogShell
        isMobile={false}
        open
        titleText="Booking for Alex"
        descriptionText="Booking details dialog"
        onOpenChange={vi.fn()}
      >
        <p>Dialog body</p>
      </BookingDialogShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Booking for Alex' })).toBeInTheDocument();
    expect(screen.getByText('Dialog body')).toBeInTheDocument();
  });

  it('@contract renders the mobile bottom sheet variant', () => {
    render(
      <BookingDialogShell
        isMobile
        open
        titleText="Booking for Alex"
        descriptionText="Booking details sheet"
        onOpenChange={vi.fn()}
      >
        <p>Sheet body</p>
      </BookingDialogShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Booking for Alex' })).toBeInTheDocument();
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
  });

  it('@contract escape requests close through onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <BookingDialogShell
        isMobile={false}
        open
        titleText="Booking for Alex"
        descriptionText="Booking details dialog"
        onOpenChange={onOpenChange}
      >
        <p>Dialog body</p>
      </BookingDialogShell>,
    );

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@smoke layout slots header, body, and action rail', () => {
    render(
      <BookingDialogLayout
        headerTone=""
        header={<div>Header slot</div>}
        body={<div>Body slot</div>}
        actionRail={<div>Rail slot</div>}
      />,
    );

    expect(screen.getByText('Header slot')).toBeInTheDocument();
    expect(screen.getByText('Body slot')).toBeInTheDocument();
    expect(screen.getByText('Rail slot')).toBeInTheDocument();
  });
});
