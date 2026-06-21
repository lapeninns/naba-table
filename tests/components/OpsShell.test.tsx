import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { OpsShell } from '@/components/features/ops-shell/OpsShell';
import { useOpsSession, OpsSessionProvider } from '@/contexts/ops-session';

import type { OpsMembership, OpsUser } from '@/types/ops';

vi.mock('@/components/features/ops-shell/OpsSidebarLayout', () => ({
  OpsSidebarLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const baseMemberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'The White Horse',
    role: 'owner',
    createdAt: null,
  },
  {
    restaurantId: 'rest-2',
    restaurantName: 'The Crown',
    role: 'owner',
    createdAt: null,
  },
];

function createUser(id: string, email: string): OpsUser {
  return { id, email };
}

function OpsContentProbe() {
  const { activeRestaurantId, setActiveRestaurantId, user } = useOpsSession();
  const [draftValue, setDraftValue] = useState('fresh');

  return (
    <div>
      <p>user:{user?.email ?? 'none'}</p>
      <p>restaurant:{activeRestaurantId ?? 'none'}</p>
      <p>draft:{draftValue}</p>
      <button type="button" onClick={() => setDraftValue('edited')}>
        Edit local state
      </button>
      <button type="button" onClick={() => setActiveRestaurantId('rest-2')}>
        Switch restaurant
      </button>
    </div>
  );
}

function renderShell({
  user,
  memberships = baseMemberships,
  initialRestaurantId = 'rest-1',
}: {
  user: OpsUser;
  memberships?: OpsMembership[];
  initialRestaurantId?: string | null;
}) {
  return render(
    <OpsSessionProvider
      user={user}
      memberships={memberships}
      initialRestaurantId={initialRestaurantId}
    >
      <OpsShell>
        <OpsContentProbe />
      </OpsShell>
    </OpsSessionProvider>,
  );
}

describe('OpsShell', () => {
  it('remounts ops content when the active restaurant changes', async () => {
    const user = userEvent.setup();

    renderShell({
      user: createUser('user-1', 'first@example.com'),
    });

    expect(screen.getByText('restaurant:rest-1')).toBeInTheDocument();
    expect(screen.getByText('draft:fresh')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit local state' }));
    expect(screen.getByText('draft:edited')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Switch restaurant' }));

    expect(screen.getByText('restaurant:rest-2')).toBeInTheDocument();
    expect(screen.getByText('draft:fresh')).toBeInTheDocument();
  });

  it('remounts ops content when the authenticated account changes', async () => {
    const user = userEvent.setup();
    const firstUser = createUser('user-1', 'first@example.com');
    const secondUser = createUser('user-2', 'second@example.com');

    const view = renderShell({
      user: firstUser,
    });

    await user.click(screen.getByRole('button', { name: 'Edit local state' }));
    expect(screen.getByText('draft:edited')).toBeInTheDocument();

    view.rerender(
      <OpsSessionProvider
        user={secondUser}
        memberships={baseMemberships}
        initialRestaurantId="rest-1"
      >
        <OpsShell>
          <OpsContentProbe />
        </OpsShell>
      </OpsSessionProvider>,
    );

    expect(screen.getByText('user:second@example.com')).toBeInTheDocument();
    expect(screen.getByText('draft:fresh')).toBeInTheDocument();
  });
});
