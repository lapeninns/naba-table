import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarCollapsedRailToggle } from '@/components/features/ops-shell/patterns/SidebarCollapsedRailToggle';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';

// `mockReset: true` wipes the global setup matchMedia stub between tests;
// SidebarProvider needs it (useIsMobile), so re-stub per test.
beforeEach(() => {
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

function SidebarStateProbe() {
  const { state } = useSidebar();
  return <p>sidebar-state:{state}</p>;
}

describe('SidebarCollapsedRailToggle', () => {
  it('@contract renders the rail children alongside the open-sidebar control', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarCollapsedRailToggle>
          <span>Rail avatar</span>
        </SidebarCollapsedRailToggle>
      </SidebarProvider>,
    );

    expect(screen.getByText('Rail avatar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
  });

  it('@contract expands the collapsed sidebar when the hover control is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarCollapsedRailToggle>
          <span>Rail avatar</span>
        </SidebarCollapsedRailToggle>
        <SidebarStateProbe />
      </SidebarProvider>,
    );

    expect(screen.getByText('sidebar-state:collapsed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open sidebar' }));

    expect(screen.getByText('sidebar-state:expanded')).toBeInTheDocument();
  });

  it('@contract honors a custom open label', () => {
    render(
      <SidebarProvider defaultOpen={false}>
        <SidebarCollapsedRailToggle openLabel="Reveal navigation">
          <span>Logo</span>
        </SidebarCollapsedRailToggle>
      </SidebarProvider>,
    );

    expect(screen.getByRole('button', { name: 'Reveal navigation' })).toBeInTheDocument();
  });
});
