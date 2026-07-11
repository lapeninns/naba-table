import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestDepositCard } from '@/components/features/dashboard/booking-details/components/guest/GuestDepositCard';

describe('GuestDepositCard', () => {
  it('@smoke renders nothing without a deposit', () => {
    const { container } = render(<GuestDepositCard depositLabel={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@smoke renders the deposit amount with the Paid badge', () => {
    render(<GuestDepositCard depositLabel="£50.00" />);

    expect(screen.getByText('Deposit')).toBeInTheDocument();
    expect(screen.getByText('£50.00')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });
});
