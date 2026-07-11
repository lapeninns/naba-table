import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useOnlineStatusMock, pathnameMock, confirmNavigationMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
  pathnameMock: vi.fn(() => '/app/dashboard'),
  confirmNavigationMock: vi.fn(() => true),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  default: useOnlineStatusMock,
  useOnlineStatus: useOnlineStatusMock,
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

import { OpsMobileBottomNav } from '@/components/features/ops-shell/OpsMobileBottomNav';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';

function SidebarOpenProbe() {
  const { open } = useSidebar();
  return <p>sidebar-open:{String(open)}</p>;
}

function renderNav() {
  return render(
    <SidebarProvider defaultOpen>
      <OpsMobileBottomNav />
      <SidebarOpenProbe />
    </SidebarProvider>,
  );
}

describe('OpsMobileBottomNav', () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReturnValue(true);
    pathnameMock.mockReturnValue('/app/dashboard');
    confirmNavigationMock.mockReturnValue(true);
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

  it('@contract @a11y renders the four thumb-reachable destinations plus the menu control in a labeled nav', () => {
    renderNav();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/app/dashboard',
    );
    expect(screen.getByRole('link', { name: /^bookings$/i })).toHaveAttribute(
      'href',
      '/app/bookings',
    );
    expect(screen.getByRole('link', { name: /new booking/i })).toHaveAttribute(
      'href',
      '/app/new-bookings',
    );
    expect(screen.getByRole('link', { name: /guests/i })).toHaveAttribute('href', '/app/customers');

    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(menuButton).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('@contract marks only the current destination with aria-current', () => {
    pathnameMock.mockReturnValue('/app/bookings');
    renderNav();

    expect(screen.getByRole('link', { name: /^bookings$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /dashboard/i })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /guests/i })).not.toHaveAttribute('aria-current');
  });

  it('@contract resolves app-host pathnames (without the /app prefix) to the same active item', () => {
    pathnameMock.mockReturnValue('/customers');
    renderNav();

    expect(screen.getByRole('link', { name: /guests/i })).toHaveAttribute('aria-current', 'page');
  });

  it('@contract disables navigation while offline: links leave the tab order and clicks are prevented', async () => {
    useOnlineStatusMock.mockReturnValue(false);
    const user = userEvent.setup();
    renderNav();

    const bookingsLink = screen.getByRole('link', { name: /^bookings$/i });
    expect(bookingsLink).toHaveAttribute('aria-disabled', 'true');
    expect(bookingsLink).toHaveAttribute('tabindex', '-1');

    let lastClick: MouseEvent | null = null;
    document.addEventListener('click', (event) => {
      lastClick = event;
    });

    await user.click(bookingsLink);

    expect(lastClick).not.toBeNull();
    expect((lastClick as unknown as MouseEvent).defaultPrevented).toBe(true);
    // Offline clicks bail before the unsaved-changes gate.
    expect(confirmNavigationMock).not.toHaveBeenCalled();
  });

  it('@contract blocks navigation when unsaved changes are not confirmed', async () => {
    confirmNavigationMock.mockReturnValue(false);
    const user = userEvent.setup();
    renderNav();

    let lastClick: MouseEvent | null = null;
    document.addEventListener('click', (event) => {
      lastClick = event;
    });

    await user.click(screen.getByRole('link', { name: /guests/i }));

    expect(confirmNavigationMock).toHaveBeenCalledTimes(1);
    expect((lastClick as unknown as MouseEvent).defaultPrevented).toBe(true);
  });

  it('@contract toggles the sidebar from the menu control', async () => {
    const user = userEvent.setup();
    renderNav();

    expect(screen.getByText('sidebar-open:true')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    expect(screen.getByText('sidebar-open:false')).toBeInTheDocument();
  });
});
