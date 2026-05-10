import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BookingRecoverErrorPage from '@src/app/(public)/bookings/recover/error/page';
import { ReservationThankYouCard } from '@src/components/restaurants/PublicSections';

import type { ComponentProps, ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: ComponentProps<'img'>) => <img alt={props.alt ?? ''} {...props} />,
}));
vi.mock('@/guest/services/auth-state.server', () => ({
  getGuestAuthState: vi.fn(async () => ({ isAuthenticated: false })),
}));

describe('public booking confirmation and recovery surfaces', () => {
  it('renders the canonical restaurant thank-you copy and exits', () => {
    const restaurant = {
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      address: '1 High Street',
    };

    const { container } = render(
      <ReservationThankYouCard restaurant={restaurant} isAuthenticated={false} />,
    );

    expect(screen.getByRole('heading', { name: 'Your table request is in.' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your table request for The Fox is in. Check your inbox for confirmation details, or sign in with the booking email to keep it with your guest portal.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to view bookings' })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=/guest/bookings',
    );
    expect(screen.getByRole('link', { name: 'Explore restaurants' })).toHaveAttribute(
      'href',
      '/restaurants',
    );
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });

  it('renders code-specific booking recovery guidance with the fixed CTA set', async () => {
    const { container } = render(
      await BookingRecoverErrorPage({
        searchParams: Promise.resolve({ code: 'ACCESS_TOKEN_EXPIRED' }),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'This booking link has expired' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'For safety, booking recovery links expire after a period of time. Your booking may still be valid.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/signin');
    expect(screen.getByRole('link', { name: 'Manage another booking' })).toHaveAttribute(
      'href',
      '/bookings',
    );
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });
});
