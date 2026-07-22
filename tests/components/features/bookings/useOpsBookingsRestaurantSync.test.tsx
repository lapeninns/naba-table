import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useOpsBookingsRestaurantSync } from '@/components/features/bookings/useOpsBookingsRestaurantSync';
import { OpsSessionProvider, useOpsSession } from '@/contexts/ops-session';

import type { OpsMembership, OpsUser } from '@/types/ops';

const user: OpsUser = { id: 'user-1', email: 'ops@example.com' };
const memberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'Restaurant One',
    restaurantSlug: 'restaurant-one',
    role: 'owner',
    createdAt: null,
  },
  {
    restaurantId: 'rest-2',
    restaurantName: 'Restaurant Two',
    restaurantSlug: 'restaurant-two',
    role: 'manager',
    createdAt: null,
  },
];

function RestaurantSync({ initialRestaurantId }: { initialRestaurantId: string | null }) {
  useOpsBookingsRestaurantSync({
    initialRestaurantId,
  });

  return null;
}

function Harness() {
  const { activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const [initialRestaurantId, setInitialRestaurantId] = useState<string | null>('rest-1');

  return (
    <>
      <p>active:{activeRestaurantId}</p>
      <button type="button" onClick={() => setActiveRestaurantId('rest-2')}>
        Switch restaurant
      </button>
      <button type="button" onClick={() => setInitialRestaurantId('rest-2')}>
        Complete navigation
      </button>
      <button type="button" onClick={() => setInitialRestaurantId('rest-1')}>
        Navigate back
      </button>
      <RestaurantSync key={activeRestaurantId} initialRestaurantId={initialRestaurantId} />
    </>
  );
}

function renderHarness() {
  return render(
    <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
      <Harness />
    </OpsSessionProvider>,
  );
}

describe('useOpsBookingsRestaurantSync', () => {
  it('does not restore a stale URL restaurant when the bookings subtree remounts', async () => {
    const testUser = userEvent.setup();
    renderHarness();

    await testUser.click(screen.getByRole('button', { name: 'Switch restaurant' }));

    await waitFor(() => expect(screen.getByText('active:rest-2')).toBeInTheDocument());

    await testUser.click(screen.getByRole('button', { name: 'Complete navigation' }));
    expect(screen.getByText('active:rest-2')).toBeInTheDocument();
  });

  it('applies a restaurant when the URL changes independently', async () => {
    const testUser = userEvent.setup();
    renderHarness();

    await testUser.click(screen.getByRole('button', { name: 'Complete navigation' }));
    await waitFor(() => expect(screen.getByText('active:rest-2')).toBeInTheDocument());

    await testUser.click(screen.getByRole('button', { name: 'Navigate back' }));
    await waitFor(() => expect(screen.getByText('active:rest-1')).toBeInTheDocument());
  });
});
