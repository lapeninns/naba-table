import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestIdentityCard } from '@/components/features/dashboard/booking-details/components/guest/GuestIdentityCard';

import { makeBooking } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('GuestIdentityCard', () => {
  it('@smoke renders the guest name, initials, and primary-guest label', () => {
    render(<GuestIdentityCard booking={makeBooking({ customerName: 'Priya Patel' })} />);

    expect(screen.getByRole('heading', { name: 'Priya Patel' })).toBeInTheDocument();
    expect(screen.getByText('PP')).toBeInTheDocument();
    expect(screen.getByText('Primary Guest')).toBeInTheDocument();
  });
});
