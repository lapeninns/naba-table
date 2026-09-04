import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewGrowthClient } from '@/components/features/review-growth/ReviewGrowthClient';
import { OpsSessionProvider } from '@/contexts/ops-session';

const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    usePathname: () => '/app/communications-delivery/reviews',
    useSearchParams: () => new URLSearchParams('restaurantId=rest-1&range=30d'),
    useRouter: () => ({ replace: routerReplaceMock }),
  };
});

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => ({
    data: { id: 'rest-1', name: 'Test Restaurant', timezone: 'Europe/London' },
  }),
}));

vi.mock('@/hooks/ops/useOpsReviewGrowthSummary', () => ({
  useOpsReviewGrowthSummary: () => ({
    isLoading: false,
    data: {
      ok: true,
      restaurantId: 'rest-1',
      range: '30d',
      summary: {
        from: '2026-08-06T12:00:00.000Z',
        to: '2026-09-05T12:00:00.000Z',
        completedVisits: 535,
        eligible: 470,
        suppressed: 65,
        sent: 450,
        reached: 388,
        clicked: 92,
        newGoogleReviews: 31,
        channels: {
          whatsapp: {
            sent: 424,
            delivered: 388,
            read: 299,
            opened: 0,
            clicked: 76,
            failed: 33,
            costMicrounits: 20_140_000,
            costCurrency: 'GBP',
          },
          email: {
            sent: 74,
            delivered: 70,
            read: 0,
            opened: 39,
            clicked: 16,
            failed: 4,
            costMicrounits: 0,
            costCurrency: null,
          },
        },
      },
    },
  }),
}));

describe('ReviewGrowthClient', () => {
  beforeEach(() => routerReplaceMock.mockReset());

  it('renders the funnel, channel comparison, cost, and policy guardrails', () => {
    render(
      <OpsSessionProvider
        user={{ id: 'user-1', email: 'ops@example.com' }}
        memberships={[
          {
            id: 'membership-1',
            restaurantId: 'rest-1',
            restaurantName: 'Test Restaurant',
            role: 'owner',
          },
        ]}
        initialRestaurantId="rest-1"
      >
        <ReviewGrowthClient initialRestaurantId="rest-1" initialRange="30d" />
      </OpsSessionProvider>,
    );

    expect(screen.getByText('Review Growth')).toBeInTheDocument();
    expect(screen.getByText('New Google reviews observed')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp vs email')).toBeInTheDocument();
    expect(screen.getByText('£20.14')).toBeInTheDocument();
    expect(screen.getByText('Email after 48h without a click')).toBeInTheDocument();
    expect(screen.getByText('90-day guest cooldown')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reviews/ })).toHaveAttribute('aria-current', 'page');
  });
});
