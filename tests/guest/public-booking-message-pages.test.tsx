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

describe('public booking confirmation and recovery surfaces', () => {
  it('renders the canonical restaurant thank-you copy and exits', () => {
    const { container } = render(<ReservationThankYouCard />);

    expect(
      screen.getByRole('heading', { name: 'Reservation confirmed!' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Confirmation email sent with your details and link.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View my bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
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

    expect(screen.getByRole('heading', { name: 'Link has expired' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'This booking link has expired. Please request a new link or sign in to manage your booking.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth/signin',
    );
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
    expect(container.querySelector('main')).not.toBeInTheDocument();
  });
});
