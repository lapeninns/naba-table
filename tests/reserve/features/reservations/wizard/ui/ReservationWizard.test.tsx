import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReservationWizard } from '@features/reservations/wizard/ui/ReservationWizard';

import type { WizardDependencies } from '@features/reservations/wizard/di';

// ReservationWizard is a composition wrapper: DI provider + BookingWizard.
const harness = vi.hoisted(() => ({
  bookingWizardProps: vi.fn(),
  seenDependencies: vi.fn(),
}));

vi.mock('@features/reservations/wizard/ui/BookingWizard', async () => {
  const { useWizardDependencies } = await import('@features/reservations/wizard/di/context');
  function BookingWizardStub(props: Record<string, unknown>) {
    harness.bookingWizardProps(props);
    harness.seenDependencies(useWizardDependencies());
    return <p>booking-wizard-stub</p>;
  }
  return { BookingWizard: BookingWizardStub, default: BookingWizardStub };
});

beforeEach(() => {
  harness.bookingWizardProps.mockClear();
  harness.seenDependencies.mockClear();
});

describe('ReservationWizard', () => {
  it('renders the booking wizard with customer defaults @smoke', () => {
    render(<ReservationWizard />);

    expect(screen.getByText('booking-wizard-stub')).toBeInTheDocument();
    expect(harness.bookingWizardProps).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'customer',
        layoutElement: 'main',
        layoutSurface: 'guest',
      }),
    );
  });

  it('forwards initial details and layout options @contract', () => {
    render(
      <ReservationWizard
        initialDetails={{ restaurantSlug: 'the-fox' }}
        mode="ops"
        layoutElement="div"
        layoutSurface="ops"
        returnPath="/ops/bookings"
        redirectOnSuccess
      />,
    );

    expect(harness.bookingWizardProps).toHaveBeenCalledWith(
      expect.objectContaining({
        initialDetails: { restaurantSlug: 'the-fox' },
        mode: 'ops',
        layoutElement: 'div',
        layoutSurface: 'ops',
        returnPath: '/ops/bookings',
        redirectOnSuccess: true,
      }),
    );
  });

  it('installs dependency overrides through the DI provider @contract', () => {
    const analytics: WizardDependencies['analytics'] = { track: vi.fn() };
    render(<ReservationWizard dependencies={{ analytics }} />);

    const deps = harness.seenDependencies.mock.calls[0]?.[0] as WizardDependencies;
    expect(deps.analytics).toBe(analytics);
    // Unspecified dependencies fall back to defaults rather than disappearing.
    expect(typeof deps.navigator.push).toBe('function');
    expect(typeof deps.errorReporter.capture).toBe('function');
  });
});
