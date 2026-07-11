import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestContactCard } from '@/components/features/dashboard/booking-details/components/guest/GuestContactCard';

import { makeBooking } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('GuestContactCard', () => {
  it('@contract renders phone with tel link and a WhatsApp action', () => {
    render(
      <GuestContactCard
        booking={makeBooking({ customerPhone: '+44 7700 900123', customerEmail: null })}
      />,
    );

    expect(screen.getByText('+44 7700 900123')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links.some((link) => link.getAttribute('href')?.startsWith('tel:'))).toBe(true);
    expect(
      links.some((link) => link.getAttribute('href') === 'https://wa.me/447700900123'),
    ).toBe(true);
  });

  it('@contract renders the email row with a mailto link', () => {
    render(
      <GuestContactCard
        booking={makeBooking({ customerPhone: null, customerEmail: 'alex@example.com' })}
      />,
    );

    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link')
        .some((link) => link.getAttribute('href') === 'mailto:alex@example.com'),
    ).toBe(true);
  });

  it('@contract falls back to the no-contact notice when both channels are missing', () => {
    render(
      <GuestContactCard booking={makeBooking({ customerPhone: null, customerEmail: null })} />,
    );

    expect(screen.getByText('No contact details provided')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
