import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestProfileIdentitySection } from '@/components/features/dashboard/booking-details/components/GuestProfileIdentitySection';

import {
  makeBooking,
  makeFlattenedTable,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { GuestProfileIdentitySectionProps } from '@/components/features/dashboard/booking-details/components/GuestProfileIdentitySection';

function makeProps(
  overrides: Partial<GuestProfileIdentitySectionProps> = {},
): GuestProfileIdentitySectionProps {
  return {
    booking: makeBooking(),
    initials: 'AE',
    isLate: false,
    whatsappHref: 'https://wa.me/447700900123',
    assignedTableRows: [makeFlattenedTable()],
    ...overrides,
  };
}

describe('GuestProfileIdentitySection', () => {
  it('@contract renders the guest identity with contact shortcut buttons', () => {
    render(<GuestProfileIdentitySection {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Alex Example' })).toBeInTheDocument();
    expect(screen.getByText('Primary Guest')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /\+44 7700 900123/ })).toHaveAttribute(
      'href',
      expect.stringContaining('tel:'),
    );
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/447700900123',
    );
    expect(screen.getByRole('link', { name: /Email/ })).toHaveAttribute(
      'href',
      'mailto:alex@example.com',
    );
  });

  it('@contract flags late guests', () => {
    render(<GuestProfileIdentitySection {...makeProps({ isLate: true })} />);

    expect(screen.getByText('Late')).toBeInTheDocument();
  });

  it('@contract shows the No table badge when assignment is still required', () => {
    render(<GuestProfileIdentitySection {...makeProps({ assignedTableRows: [] })} />);

    expect(screen.getByText('No table')).toBeInTheDocument();
  });

  it('@contract hides contact shortcuts when the booking has no channels', () => {
    render(
      <GuestProfileIdentitySection
        {...makeProps({
          booking: makeBooking({ customerPhone: null, customerEmail: null }),
          whatsappHref: null,
        })}
      />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
