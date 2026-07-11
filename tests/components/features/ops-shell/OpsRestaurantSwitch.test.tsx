import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmNavigationMock } = vi.hoisted(() => ({
  confirmNavigationMock: vi.fn(() => true),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: confirmNavigationMock }),
}));

import { OpsRestaurantSwitch } from '@/components/features/ops-shell/OpsRestaurantSwitch';
import { SidebarProvider } from '@/components/ui/sidebar';
import { OpsSessionProvider, useOpsSession } from '@/contexts/ops-session';

import type { OpsMembership, OpsUser } from '@/types/ops';

const user: OpsUser = { id: 'user-1', email: 'ops@example.com' };

const singleMembership: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'The White Horse',
    restaurantSlug: null,
    role: 'owner',
    createdAt: null,
  },
];

const multiMemberships: OpsMembership[] = [
  ...singleMembership,
  {
    restaurantId: 'rest-2',
    restaurantName: 'The Crown',
    restaurantSlug: null,
    role: 'manager',
    createdAt: null,
  },
];

function ActiveRestaurantProbe() {
  const { activeRestaurantId } = useOpsSession();
  return <p>active:{activeRestaurantId ?? 'none'}</p>;
}

function renderSwitch(memberships: OpsMembership[]) {
  return render(
    <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
      <SidebarProvider defaultOpen>
        <OpsRestaurantSwitch />
        <ActiveRestaurantProbe />
      </SidebarProvider>
    </OpsSessionProvider>,
  );
}

describe('OpsRestaurantSwitch', () => {
  beforeEach(() => {
    confirmNavigationMock.mockReturnValue(true);
    window.localStorage.clear();
    // `mockReset: true` wipes the global setup matchMedia stub between tests;
    // SidebarProvider needs it (useIsMobile), so re-stub per test.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('@contract renders a static identity block without a menu for a single membership', () => {
    renderSwitch(singleMembership);

    expect(screen.getByText('The White Horse')).toBeInTheDocument();
    expect(screen.getByText('TW')).toBeInTheDocument();
    expect(screen.getByText('ops@example.com (owner)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { expanded: false })).not.toBeInTheDocument();
  });

  it('@contract @a11y opens a searchable restaurant listbox for multiple memberships', async () => {
    const testUser = userEvent.setup();
    renderSwitch(multiMemberships);

    const trigger = screen.getByRole('button', { name: /the white horse/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await testUser.click(trigger);

    expect(await screen.findByRole('option', { name: /the crown/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /the white horse/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('searchbox', { name: 'Search restaurants' })).toBeInTheDocument();
  });

  it('@contract switches the active restaurant when another option is selected', async () => {
    const testUser = userEvent.setup();
    renderSwitch(multiMemberships);

    expect(screen.getByText('active:rest-1')).toBeInTheDocument();

    await testUser.click(screen.getByRole('button', { name: /the white horse/i }));
    await testUser.click(await screen.findByRole('option', { name: /the crown/i }));

    expect(screen.getByText('active:rest-2')).toBeInTheDocument();
    expect(confirmNavigationMock).toHaveBeenCalledTimes(1);
  });

  it('@contract keeps the current restaurant when the unsaved-changes gate declines', async () => {
    confirmNavigationMock.mockReturnValue(false);
    const testUser = userEvent.setup();
    renderSwitch(multiMemberships);

    await testUser.click(screen.getByRole('button', { name: /the white horse/i }));
    await testUser.click(await screen.findByRole('option', { name: /the crown/i }));

    expect(screen.getByText('active:rest-1')).toBeInTheDocument();
  });

  it('@contract filters memberships by the debounced search term and shows an empty message for no matches', async () => {
    const testUser = userEvent.setup();
    renderSwitch(multiMemberships);

    await testUser.click(screen.getByRole('button', { name: /the white horse/i }));
    const search = screen.getByRole('searchbox', { name: 'Search restaurants' });

    // fireEvent.change drives the controlled input directly; Radix menu
    // typeahead would otherwise swallow userEvent keystrokes.
    fireEvent.change(search, { target: { value: 'crown' } });

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /the white horse/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: /the crown/i })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz-no-match' } });

    expect(await screen.findByText('No matches. Try a different search.')).toBeInTheDocument();
  });
});
