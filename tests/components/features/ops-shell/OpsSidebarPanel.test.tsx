import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pathnameMock, confirmNavigationMock, prefetchRouteMock, signOutMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn<() => string | null>(() => '/app/dashboard'),
  confirmNavigationMock: vi.fn(() => true),
  prefetchRouteMock: vi.fn(),
  signOutMock: vi.fn(async () => undefined),
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    usePathname: () => pathnameMock(),
  };
});

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: confirmNavigationMock }),
}));

vi.mock('@/components/features/ops-shell/useOpsRoutePrefetch', () => ({
  useOpsRoutePrefetch: () => prefetchRouteMock,
}));

vi.mock('@/lib/supabase/signOut', () => ({
  signOutFromSupabase: signOutMock,
}));

import { OpsSidebarPanel } from '@/components/features/ops-shell/OpsSidebarPanel';
import { SidebarProvider } from '@/components/ui/sidebar';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { OpsMembership, OpsUser } from '@/types/ops';
import type { RestaurantRole } from '@/lib/owner/auth/roles';

const user: OpsUser = { id: 'user-1', email: 'ops@example.com' };

function membershipWithRole(role: RestaurantRole): OpsMembership[] {
  return [
    {
      restaurantId: 'rest-1',
      restaurantName: 'The White Horse',
      restaurantSlug: null,
      role,
      createdAt: null,
    },
  ];
}

function renderPanel(role: RestaurantRole = 'owner') {
  return render(
    <OpsSessionProvider user={user} memberships={membershipWithRole(role)} initialRestaurantId="rest-1">
      <SidebarProvider defaultOpen>
        <OpsSidebarPanel />
      </SidebarProvider>
    </OpsSessionProvider>,
  );
}

describe('OpsSidebarPanel', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/app/dashboard');
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

  it('@contract renders the restaurant identity, all core nav sections, and the footer actions', () => {
    renderPanel('owner');

    // The identity block renders twice: expanded header + collapsed icon-rail
    // variant (CSS-gated, both present in JSDOM).
    expect(screen.getAllByText('The White Horse').length).toBeGreaterThan(0);
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Guests & Communications')).toBeInTheDocument();

    for (const item of [
      'Dashboard',
      'New Booking',
      'Floor plan',
      'Bookings',
      'Guests',
      'Communications Delivery',
      'Settings',
    ]) {
      expect(screen.getByRole('link', { name: item })).toBeInTheDocument();
    }

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
  });

  it('@contract shows admin-gated items to admins and hides them from non-admin roles', () => {
    const { unmount } = renderPanel('owner');
    expect(screen.getByRole('link', { name: 'Communications Delivery' })).toBeInTheDocument();
    unmount();

    renderPanel('host');
    expect(screen.queryByRole('link', { name: 'Communications Delivery' })).not.toBeInTheDocument();
    // Non-gated items are unaffected.
    expect(screen.getByRole('link', { name: 'Guests' })).toBeInTheDocument();
  });

  it('@contract @a11y marks the nav item matching the current pathname as the current page', () => {
    pathnameMock.mockReturnValue('/app/communications-delivery/email');
    renderPanel('owner');

    expect(screen.getByRole('link', { name: 'Communications Delivery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('@contract resolves app-host pathnames without the /app prefix before matching', () => {
    pathnameMock.mockReturnValue('/settings/restaurant/profile');
    renderPanel('owner');

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('@contract renders a loading skeleton instead of nav items while the pathname is unknown', () => {
    pathnameMock.mockReturnValue(null);
    renderPanel('owner');

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
