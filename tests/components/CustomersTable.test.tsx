import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CustomersTable } from '@/components/features/customers/CustomersTable';

import type { OpsGuestRowViewModel } from '@/components/features/customers/opsCustomersTypes';
import type { HTMLAttributes, ReactNode } from 'react';

type MockMotionDivProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: MockMotionDivProps) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => false,
}));

vi.mock('@/components/features/customers/OpsGuestCard', () => ({
  OpsGuestCard: ({ guest }: { guest: OpsGuestRowViewModel }) => (
    <div data-customer-id={guest.id} data-customer-email={guest.emailSearchValue} tabIndex={0}>
      <span>{guest.name}</span>
      <span>{guest.lastVisitLabel}</span>
    </div>
  ),
}));

function makeGuestRow(overrides: Partial<OpsGuestRowViewModel> = {}): OpsGuestRowViewModel {
  return {
    id: 'guest-1',
    emailSearchValue: 'alex@example.com',
    name: 'Alex Johnson',
    initials: 'AJ',
    isVip: false,
    railClass: 'border-l-border',
    visitStatusLabel: 'Returning',
    marketingLabel: 'Opted in',
    marketingBadgeVariant: 'secondary',
    email: 'alex@example.com',
    phone: '555 123 4567',
    primaryContact: 'alex@example.com',
    telHref: 'tel:5551234567',
    emailHref: 'mailto:alex@example.com',
    emailLabel: 'Email Alex Johnson',
    callLabel: 'Call Alex Johnson',
    lastVisitLabel: 'Mar 20, 2026 · 9 days ago',
    totalBookings: 4,
    totalCovers: 12,
    totalCancellations: 1,
    ...overrides,
  };
}

describe('CustomersTable', () => {
  it('renders guest rows in the non-virtualized path', () => {
    render(
      <CustomersTable
        rows={[makeGuestRow(), makeGuestRow({ id: 'guest-2', name: 'Sam Patel' })]}
        isLoading={false}
      />,
    );

    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.getByText('Sam Patel')).toBeInTheDocument();
    expect(screen.getAllByText('Mar 20, 2026 · 9 days ago')).toHaveLength(2);
  });

  it('shows the filtered empty state when no rows match', () => {
    render(<CustomersTable rows={[]} isLoading={false} hasActiveFilters />);

    expect(screen.getByText('No guests match these filters')).toBeInTheDocument();
  });

  it('focuses a matching row from the focus query in the non-virtualized path', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

    render(
      <CustomersTable
        rows={[
          makeGuestRow(),
          makeGuestRow({
            id: 'guest-2',
            emailSearchValue: 'sam@example.com',
            name: 'Sam Patel',
            email: 'sam@example.com',
            primaryContact: 'sam@example.com',
            emailHref: 'mailto:sam@example.com',
            emailLabel: 'Email Sam Patel',
          }),
        ]}
        isLoading={false}
        focusCustomerId="sam@example.com"
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-customer-id="guest-2"]')).toHaveFocus();
    });
    expect(scrollSpy).toHaveBeenCalled();
  });
});
