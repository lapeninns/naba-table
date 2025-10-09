import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerNavbar } from '@/components/customer/navigation/CustomerNavbar';

const mockUseSupabaseSession = vi.hoisted(() =>
  vi.fn(() => ({ user: null, status: 'ready' as const })),
);
const mockUseProfile = vi.hoisted(() => vi.fn(() => ({ data: null, isLoading: false })));
const mockSignOut = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: (...args: unknown[]) => mockUseSupabaseSession(...args),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: (...args: unknown[]) => mockUseProfile(...args),
}));

vi.mock('@/lib/supabase/signOut', () => ({
  signOutFromSupabase: (...args: unknown[]) => mockSignOut(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('<CustomerNavbar />', () => {
  beforeEach(() => {
    mockUseSupabaseSession.mockReturnValue({
      user: null,
      status: 'ready',
    });
    mockUseProfile.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders sign-in button for anonymous visitors', () => {
    render(<CustomerNavbar />);

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /account/i })).not.toBeInTheDocument();
  });

  it('shows avatar menu and triggers sign out for authenticated users', async () => {
    const user = userEvent.setup();
    mockUseSupabaseSession.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        user_metadata: { full_name: 'Ada Lovelace' },
      },
      status: 'ready',
    });
    mockUseProfile.mockReturnValue({
      data: { name: 'Ada Lovelace', image: null },
      isLoading: false,
    });

    render(<CustomerNavbar />);

    const accountButton = screen.getByRole('button', { name: /ada lovelace/i });
    await user.click(accountButton);

    expect(await screen.findByRole('menuitem', { name: /my bookings/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /manage profile/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
