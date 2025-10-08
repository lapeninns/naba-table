import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SignInForm } from '../SignInForm';

const trackMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithOtpMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...(args as Parameters<typeof trackMock>)),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: (...args: unknown[]) => emitMock(...(args as Parameters<typeof emitMock>)),
}));

vi.mock('@/lib/supabase/browser', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    refresh: routerRefreshMock,
  }),
}));

describe('<SignInForm />', () => {
  afterEach(() => {
    trackMock.mockReset();
    emitMock.mockReset();
    routerReplaceMock.mockReset();
    routerRefreshMock.mockReset();
    signInWithPasswordMock.mockReset();
    signInWithOtpMock.mockReset();
  });

  it('signs in with password credentials', async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });

    render(<SignInForm redirectedFrom="/dashboard" />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'securepass123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith('/dashboard');
    });

    expect(routerRefreshMock).toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith('auth_signin_success', expect.objectContaining({
      method: 'password',
    }));
    expect(emitMock).toHaveBeenCalledWith('auth_signin_success', expect.objectContaining({
      method: 'password',
    }));
  });

  it('shows inline error when password sign-in fails', async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: 'Invalid login credentials', status: 400, name: 'AuthApiError' },
    });

    render(<SignInForm redirectedFrom="/dashboard" />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByText(/invalid login credentials/i);
    expect(trackMock).toHaveBeenCalledWith('auth_signin_error', expect.objectContaining({
      method: 'password',
    }));
  });

  it('sends magic link and shows success message', async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });

    render(<SignInForm redirectedFrom="/dashboard" />);

    await userEvent.click(screen.getByRole('radio', { name: /magic link/i }));
    await userEvent.type(screen.getByLabelText(/email address/i), 'ada@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await screen.findByText(/magic link sent/i);
    expect(trackMock).toHaveBeenCalledWith('auth_magiclink_sent', expect.any(Object));
  });
});
