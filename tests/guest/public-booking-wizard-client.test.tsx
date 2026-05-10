import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockReservationWizard(props: Record<string, unknown>) {
      return (
        <div
          data-testid="reservation-wizard"
          data-layout-element={String(props.layoutElement)}
          data-return-path={String(props.returnPath)}
          data-restaurant-name={String(
            (props.initialDetails as { restaurantName?: string } | undefined)?.restaurantName,
          )}
        />
      );
    };
  },
}));

import { ReservationWizardClient } from '@src/components/features/booking/wizard/ReservationWizardClient';

describe('ReservationWizardClient', () => {
  it('forces embedded booking pages to render the wizard without a page-level main landmark', () => {
    render(
      <ReservationWizardClient
        restaurant={{
          id: 'rest-1',
          slug: 'the-fox',
          name: 'The Fox',
          timezone: 'Europe/London',
          address: '1 High Street',
        }}
      />,
    );

    expect(screen.getByTestId('reservation-wizard')).toHaveAttribute('data-layout-element', 'div');
    expect(screen.getByTestId('reservation-wizard')).toHaveAttribute(
      'data-return-path',
      'undefined',
    );
    expect(screen.getByTestId('reservation-wizard')).toHaveAttribute(
      'data-restaurant-name',
      'The Fox',
    );
  });
});
