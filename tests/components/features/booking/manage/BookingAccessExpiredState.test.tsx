import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BookingAccessExpiredState } from '@/components/features/booking/manage/BookingAccessExpiredState';

import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('BookingAccessExpiredState', () => {
  it('offers a new emailed link when the link expired', () => {
    render(<BookingAccessExpiredState reason="expired" isAuthenticated={false} />);
    expect(screen.getByRole('link', { name: 'Email me a new link' })).toHaveAttribute(
      'href',
      '/bookings/find',
    );
  });

  it('does not offer a new link when links are not configured (none could be sent)', () => {
    render(<BookingAccessExpiredState reason="not_configured" isAuthenticated={false} />);
    expect(screen.queryByRole('link', { name: 'Email me a new link' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Request a new link/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/auth/signin');
    expect(screen.getByText(/contact the venue/i, { selector: 'p.pg-body' })).toBeInTheDocument();
  });

  it('sends a signed-in guest to My bookings when links are not configured', () => {
    render(<BookingAccessExpiredState reason="not_configured" isAuthenticated />);
    expect(screen.queryByRole('link', { name: 'Email me a new link' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
  });
});
