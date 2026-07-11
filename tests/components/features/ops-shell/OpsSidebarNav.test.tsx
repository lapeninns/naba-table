import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarDays, Users } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useOnlineStatusMock, confirmNavigationMock, prefetchRouteMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
  confirmNavigationMock: vi.fn(() => true),
  prefetchRouteMock: vi.fn(),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  default: useOnlineStatusMock,
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: confirmNavigationMock }),
}));

// The prefetch hook has its own suite (useOpsRoutePrefetch.test.tsx); here we
// only assert the nav schedules it correctly.
vi.mock('@/components/features/ops-shell/useOpsRoutePrefetch', () => ({
  useOpsRoutePrefetch: () => prefetchRouteMock,
}));

import { OpsSidebarNav } from '@/components/features/ops-shell/OpsSidebarNav';
import { SidebarProvider } from '@/components/ui/sidebar';

import type { OpsNavigationSection } from '@/components/features/ops-shell/navigation';

const sections: OpsNavigationSection[] = [
  {
    label: 'Service',
    items: [
      {
        title: 'Bookings',
        href: '/app/bookings',
        icon: CalendarDays,
        match: (pathname) =>
          pathname === '/app/bookings' || pathname.startsWith('/app/bookings/'),
      },
      {
        title: 'Guests',
        href: '/app/customers',
        icon: Users,
        match: (pathname) => pathname.startsWith('/app/customers'),
      },
    ],
  },
];

function renderNav(pathname = '/app/bookings') {
  return render(
    <SidebarProvider defaultOpen>
      <OpsSidebarNav sections={sections} pathname={pathname} />
    </SidebarProvider>,
  );
}

describe('OpsSidebarNav', () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReturnValue(true);
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract @a11y renders section labels and marks only the matching item as the current page', () => {
    renderNav('/app/bookings');

    expect(screen.getByText('Service')).toBeInTheDocument();

    const bookings = screen.getByRole('link', { name: 'Bookings' });
    expect(bookings).toHaveAttribute('aria-current', 'page');
    expect(bookings.closest('[data-active="true"]')).not.toBeNull();

    const guests = screen.getByRole('link', { name: 'Guests' });
    expect(guests).not.toHaveAttribute('aria-current');
    expect(guests.closest('[data-active="true"]')).toBeNull();
  });

  it('@contract schedules a route prefetch 200ms after hover, not immediately', () => {
    vi.useFakeTimers();
    renderNav();

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Guests' }));
    expect(prefetchRouteMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(prefetchRouteMock).toHaveBeenCalledTimes(1);
    expect(prefetchRouteMock).toHaveBeenCalledWith('/app/customers');
  });

  it('@contract collapses rapid hovers across items into a single prefetch for the last target', () => {
    vi.useFakeTimers();
    renderNav();

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Guests' }));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Bookings' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(prefetchRouteMock).toHaveBeenCalledTimes(1);
    expect(prefetchRouteMock).toHaveBeenCalledWith('/app/bookings');
  });

  it('@contract schedules a prefetch on keyboard focus as well', () => {
    vi.useFakeTimers();
    renderNav();

    fireEvent.focus(screen.getByRole('link', { name: 'Guests' }));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(prefetchRouteMock).toHaveBeenCalledWith('/app/customers');
  });

  it('@contract prevents navigation while offline and skips the unsaved-changes gate', async () => {
    useOnlineStatusMock.mockReturnValue(false);
    const user = userEvent.setup();
    renderNav();

    const guests = screen.getByRole('link', { name: 'Guests' });
    expect(guests).toHaveAttribute('aria-disabled', 'true');

    let lastClick: MouseEvent | null = null;
    document.addEventListener('click', (event) => {
      lastClick = event;
    });

    await user.click(guests);

    expect((lastClick as unknown as MouseEvent).defaultPrevented).toBe(true);
    expect(confirmNavigationMock).not.toHaveBeenCalled();
  });

  it('@contract blocks navigation when the unsaved-changes gate declines', async () => {
    confirmNavigationMock.mockReturnValue(false);
    const user = userEvent.setup();
    renderNav();

    let lastClick: MouseEvent | null = null;
    document.addEventListener('click', (event) => {
      lastClick = event;
    });

    await user.click(screen.getByRole('link', { name: 'Guests' }));

    expect(confirmNavigationMock).toHaveBeenCalledTimes(1);
    expect((lastClick as unknown as MouseEvent).defaultPrevented).toBe(true);
  });
});
