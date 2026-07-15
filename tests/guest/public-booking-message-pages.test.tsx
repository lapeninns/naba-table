import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReservationThankYouPage from '@src/app/(public)/(marketing)/restaurants/[slug]/book/thank-you/page';
import BookingRecoverErrorPage from '@src/app/(public)/bookings/recover/error/page';
import { ReservationThankYouCard } from '@src/components/restaurants/PublicSections';

import type { ComponentProps, ReactNode } from 'react';

const { getGuestAuthStateMock, getRestaurantBySlugMock, notFoundMock } = vi.hoisted(() => ({
  getGuestAuthStateMock: vi.fn(),
  getRestaurantBySlugMock: vi.fn(),
  notFoundMock: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

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
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));
vi.mock('@/guest/services/auth-state.server', () => ({
  getGuestAuthState: getGuestAuthStateMock,
}));
vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: getRestaurantBySlugMock,
}));

describe('public booking confirmation and recovery surfaces', () => {
  beforeEach(() => {
    getGuestAuthStateMock.mockReset();
    getGuestAuthStateMock.mockResolvedValue({ isAuthenticated: false });
    getRestaurantBySlugMock.mockReset();
    notFoundMock.mockClear();
  });

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
    expect(screen.getByRole('complementary', { name: 'Request details' })).toHaveTextContent(
      'The Fox',
    );
    expect(screen.getByRole('navigation', { name: 'Thank-you actions' })).toBeInTheDocument();
    expect(container.querySelector('[data-reservation-thank-you]')).toHaveClass(
      'lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.72fr)]',
    );
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });

  it('preserves the authenticated guest exit without coupling to the booking wizard', () => {
    const restaurant = {
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      address: '1 High Street',
    };

    render(<ReservationThankYouCard restaurant={restaurant} isAuthenticated />);

    expect(screen.getByRole('link', { name: 'View my bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /continue booking/i })).not.toBeInTheDocument();
  });

  it('loads the thank-you route directly from its restaurant and auth state', async () => {
    const restaurant = {
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      address: '1 High Street',
    };
    getRestaurantBySlugMock.mockResolvedValue(restaurant);
    getGuestAuthStateMock.mockResolvedValue({ isAuthenticated: true });

    render(
      await ReservationThankYouPage({
        params: Promise.resolve({ slug: 'the-fox' }),
      }),
    );

    expect(getRestaurantBySlugMock).toHaveBeenCalledWith('the-fox');
    expect(getGuestAuthStateMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'View my bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
  });

  it('uses the safe not-found boundary when the restaurant is missing', async () => {
    getRestaurantBySlugMock.mockResolvedValue(null);

    await expect(
      ReservationThankYouPage({
        params: Promise.resolve({ slug: 'missing-restaurant' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getGuestAuthStateMock).not.toHaveBeenCalled();
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

  it('normalizes duplicated recovery codes before rendering reason details', async () => {
    render(
      await BookingRecoverErrorPage({
        searchParams: Promise.resolve({ code: ['ACCESS_TOKEN_EXPIRED', 'INVALID_ACCESS_TOKEN'] }),
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'This booking link has expired' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ACCESS TOKEN EXPIRED')).toBeInTheDocument();
  });
});
