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
vi.mock('@/guest/services/auth-state.server', () => ({
  getGuestAuthState: vi.fn(async () => ({ isAuthenticated: false })),
}));

describe('public bookings page', () => {
  it('keeps the hub copy, card descriptions, and canonical booking entry links', async () => {
    const { container } = render(await BookingsLandingPage());

    expect(screen.getAllByText('Book a table').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Start a new booking' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choose a restaurant, pick a time, and confirm your table. Already booked? Sign in with your reservation email to view bookings and receipts.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Choose a restaurant' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Browse available restaurants, pick a date and time, then confirm your table.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'View existing bookings' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Use your reservation email to see upcoming bookings, past visits, and receipts.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Browse restaurants' })).toHaveAttribute(
      'href',
      '/restaurants',
    );
    expect(screen.getByRole('link', { name: 'Sign in to view bookings' })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=/guest/bookings',
    );
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });

  it('keeps the action cards mobile-first while restoring the responsive split layout', async () => {
    render(await BookingsLandingPage());

    const panels = screen.getByRole('heading', { name: 'Choose a restaurant' }).closest('.grid');
    const browseRestaurants = screen.getByRole('link', { name: 'Browse restaurants' });
    const signIn = screen.getByRole('link', { name: 'Sign in to view bookings' });

    expect(panels).toHaveClass('lg:grid-cols-[7fr_5fr]');
    expect(browseRestaurants).toHaveClass('w-full', 'h-11', 'sm:w-auto');
    expect(signIn).toHaveClass('w-full', 'h-11', 'sm:w-auto');
  });
});
