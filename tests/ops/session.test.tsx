import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { OpsSessionProvider, useOpsActiveRestaurantId } from '@/contexts/ops-session';
import type { OpsMembership, OpsUser } from '@/types/ops';

function ActiveRestaurantProbe() {
  const restaurantId = useOpsActiveRestaurantId();
  return <span data-testid="active-restaurant">{restaurantId ?? 'none'}</span>;
}

const memberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'Alinea',
    restaurantSlug: 'alinea',
    role: 'owner',
    createdAt: null,
  },
  {
    restaurantId: 'rest-2',
    restaurantName: 'Benu',
    restaurantSlug: 'benu',
    role: 'admin',
    createdAt: null,
  },
];

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

describe('OpsSessionProvider storage sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('updates the active restaurant when a storage event fires', async () => {
    render(
      <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId={memberships[0].restaurantId}>
        <ActiveRestaurantProbe />
      </OpsSessionProvider>,
    );

    expect(screen.getByTestId('active-restaurant')).toHaveTextContent('rest-1');

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'ops.activeRestaurantId',
          newValue: 'rest-2',
        }),
      );
    });

    await waitFor(() => expect(screen.getByTestId('active-restaurant')).toHaveTextContent('rest-2'));
  });

  it('falls back to the first membership when the stored id is invalid', async () => {
    render(
      <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId={memberships[0].restaurantId}>
        <ActiveRestaurantProbe />
      </OpsSessionProvider>,
    );

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'ops.activeRestaurantId',
          newValue: 'invalid-rest',
        }),
      );
    });

    await waitFor(() => expect(screen.getByTestId('active-restaurant')).toHaveTextContent('rest-1'));
  });
});
