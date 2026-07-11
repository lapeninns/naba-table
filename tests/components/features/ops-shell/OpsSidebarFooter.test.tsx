import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmNavigationMock, signOutMock } = vi.hoisted(() => ({
  confirmNavigationMock: vi.fn(() => true),
  signOutMock: vi.fn(async () => undefined),
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({ confirmNavigation: confirmNavigationMock }),
}));

vi.mock('@/lib/supabase/signOut', () => ({
  signOutFromSupabase: signOutMock,
}));

import { OpsSidebarFooter } from '@/components/features/ops-shell/OpsSidebarFooter';
import { OPS_SUPPORT_ITEM } from '@/components/features/ops-shell/navigation';
import { SidebarProvider } from '@/components/ui/sidebar';

function renderFooter() {
  return render(
    <SidebarProvider defaultOpen>
      <OpsSidebarFooter />
    </SidebarProvider>,
  );
}

describe('OpsSidebarFooter', () => {
  beforeEach(() => {
    confirmNavigationMock.mockReturnValue(true);
    signOutMock.mockResolvedValue(undefined);
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

  it('@contract renders the account log-out action and the support mailto link', () => {
    renderFooter();

    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.getByText('Need help?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: OPS_SUPPORT_ITEM.title })).toHaveAttribute(
      'href',
      OPS_SUPPORT_ITEM.href,
    );
  });

  it('@contract signs out via Supabase and shows a busy state when log out is clicked', async () => {
    // Never resolve so the busy state stays observable.
    signOutMock.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
    const busyButton = await screen.findByRole('button', { name: 'Signing out…' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
  });

  it('@contract does not sign out when the unsaved-changes gate declines', async () => {
    confirmNavigationMock.mockReturnValue(false);
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(confirmNavigationMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('@contract re-enables the log-out action when sign out fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    signOutMock.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderFooter();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Log out' })).not.toBeDisabled();
    });
    expect(consoleError).toHaveBeenCalledWith('[ops-sidebar] sign out failed', expect.any(Error));
  });
});
