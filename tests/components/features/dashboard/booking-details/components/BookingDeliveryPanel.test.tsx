import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/features/dashboard/booking-details/components/EmailDeliveryPanel', () => ({
  EmailDeliveryPanel: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="email-delivery-panel" data-embedded={embedded ? 'true' : 'false'} />
  ),
}));
vi.mock('@/components/features/dashboard/booking-details/components/SmsDeliveryPanel', () => ({
  SmsDeliveryPanel: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="sms-delivery-panel" data-embedded={embedded ? 'true' : 'false'} />
  ),
}));

import { BookingDeliveryPanel } from '@/components/features/dashboard/booking-details/components/BookingDeliveryPanel';

import { PINNED_TIMEZONE } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('BookingDeliveryPanel', () => {
  it('@contract renders email and message channels in one delivery shell', () => {
    render(<BookingDeliveryPanel bookingId="booking-1" timezone={PINNED_TIMEZONE} />);

    expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Email delivery' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Message delivery' })).toBeInTheDocument();
    expect(screen.getByTestId('email-delivery-panel')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByTestId('sms-delivery-panel')).toHaveAttribute('data-embedded', 'true');
  });
});
