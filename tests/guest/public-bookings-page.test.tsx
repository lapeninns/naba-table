import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BookingsLandingPage from '@src/app/(public)/bookings/page';

import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('public bookings page', () => {
  it('keeps the hub copy, card descriptions, and canonical booking entry links', () => {
    const { container } = render(<BookingsLandingPage />);

    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Reservations' })).toBeInTheDocument();
    expect(
      screen.getByText('Book a new table or manage existing reservations.'),
    ).toBeInTheDocument();

    const bookingActions = screen.getByRole('region', { name: 'Booking actions' });

    expect(within(bookingActions).getByRole('heading', { name: 'Book a table' })).toBeInTheDocument();
    expect(
      within(bookingActions).getByText(
        'Find a restaurant, pick a date and time, and confirm your reservation.',
      ),
    ).toBeInTheDocument();
    expect(
      within(bookingActions).getByRole('heading', { name: 'Manage bookings' }),
    ).toBeInTheDocument();
    expect(
      within(bookingActions).getByText(
        'Sign in to see your upcoming and past bookings, or make changes where available.',
      ),
    ).toBeInTheDocument();

    expect(
      within(bookingActions).getByRole('link', { name: 'Browse restaurants' }),
    ).toHaveAttribute('href', '/restaurants');
    expect(within(bookingActions).getByRole('link', { name: 'View my bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
    expect(within(bookingActions).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=/bookings',
    );
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });

  it('keeps the action cards mobile-first while restoring the small-screen split layout', () => {
    render(<BookingsLandingPage />);

    const bookingActions = screen.getByRole('region', { name: 'Booking actions' });
    const browseRestaurants = within(bookingActions).getByRole('link', {
      name: 'Browse restaurants',
    });
    const viewMyBookings = within(bookingActions).getByRole('link', {
      name: 'View my bookings',
    });
    const signIn = within(bookingActions).getByRole('link', { name: 'Sign in' });

    expect(bookingActions).toHaveClass('sm:grid-cols-2');
    expect(browseRestaurants).toHaveClass('w-full', 'min-h-[44px]', 'sm:w-auto');
    expect(viewMyBookings).toHaveClass('w-full', 'min-h-[44px]', 'sm:w-auto');
    expect(signIn).toHaveClass('w-full', 'min-h-[44px]', 'sm:w-auto');
  });
});
