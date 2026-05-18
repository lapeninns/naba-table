import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsSignInForm } from '../../../components/auth/OpsSignInForm';

const replaceMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const fetchJsonMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: vi.fn(),
}));

describe('OpsSignInForm', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    fetchJsonMock.mockReset();
    getUserMock.mockReset();

    fetchJsonMock.mockResolvedValue({ status: 'ok', redirectTo: '/app' });
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('tabs from email to password input without focusing the tab panel wrapper', async () => {
    const user = userEvent.setup();
    render(<OpsSignInForm />);

    await user.click(screen.getByLabelText('Email address'));
    await user.tab();

    expect(screen.getByPlaceholderText('Enter your password')).toHaveFocus();
  });

  it('submits non-empty legacy passwords unchanged instead of applying creation policy', async () => {
    const user = userEvent.setup();
    render(<OpsSignInForm redirectedFrom="/app/bookings" />);

    await user.type(screen.getByLabelText('Email address'), 'owner@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), ' legacy ');
    await user.click(screen.getByRole('button', { name: 'Sign in with password' }));

    await waitFor(() => expect(fetchJsonMock).toHaveBeenCalledTimes(1));
    expect(fetchJsonMock).toHaveBeenCalledWith(
      '/api/auth/signin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          mode: 'password',
          email: 'owner@example.com',
          password: ' legacy ',
          redirectedFrom: '/app/bookings',
        }),
      }),
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/app');
  });
});
