import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarCollapseTrigger } from '@/components/features/ops-shell/patterns/SidebarCollapseTrigger';
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

function renderTrigger({ defaultOpen = true }: { defaultOpen?: boolean } = {}) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarCollapseTrigger />
      <SidebarStateProbe />
    </SidebarProvider>,
  );
}

describe('SidebarCollapseTrigger', () => {
  it('@contract @a11y labels the trigger for the expanded state and collapses the sidebar on click', async () => {
    const user = userEvent.setup();
    renderTrigger({ defaultOpen: true });

    expect(screen.getByText('sidebar-state:expanded')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: 'Close sidebar' });
    await user.click(trigger);

    expect(screen.getByText('sidebar-state:collapsed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
  });

  it('@contract labels the trigger for the collapsed state and expands the sidebar on click', async () => {
    const user = userEvent.setup();
    renderTrigger({ defaultOpen: false });

    expect(screen.getByText('sidebar-state:collapsed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open sidebar' }));

    expect(screen.getByText('sidebar-state:expanded')).toBeInTheDocument();
  });

  it('@contract supports custom expanded/collapsed labels', () => {
    render(
      <SidebarProvider defaultOpen>
        <SidebarCollapseTrigger labels={{ expanded: 'Hide menu', collapsed: 'Show menu' }} />
      </SidebarProvider>,
    );

    expect(screen.getByRole('button', { name: 'Hide menu' })).toBeInTheDocument();
  });
});
