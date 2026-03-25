import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';

const fetchJsonMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

vi.mock('@/lib/analytics', () => ({
  track: trackMock,
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: emitMock,
}));

const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function installTurnstileMock(options: { token?: string } = {}) {
  const render = vi.fn((_: HTMLElement, config: { callback?: (token: string) => void }) => {
    if (options.token) {
      config.callback?.(options.token);
    }
    return 'turnstile-widget-id';
  });
  const reset = vi.fn();
  (window as { turnstile?: { render: typeof render; reset: typeof reset } }).turnstile = {
    render,
    reset,
  };
  return { render, reset };
}

async function renderGuestSignInForm() {
  const { GuestSignInForm } = await import('../../../components/auth/GuestSignInForm');
  return render(<GuestSignInForm redirectedFrom="/guest/dashboard" />);
}

describe('GuestSignInForm CAPTCHA policy', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    trackMock.mockReset();
    emitMock.mockReset();
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'turnstile-site-key';
  });

  afterEach(() => {
    if (typeof originalTurnstileSiteKey === 'string') {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    } else {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    }
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('cannot submit magic-link request without CAPTCHA token when enabled', async () => {
    const user = userEvent.setup();
    installTurnstileMock();
    await renderGuestSignInForm();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const submitButton = screen.getByRole('button', { name: /send magic link/i });

    await user.type(emailInput, 'guest@example.com');

    expect(submitButton).toBeDisabled();
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  it('maps CAPTCHA invalid response to guest-friendly verification error', async () => {
    const user = userEvent.setup();
    const turnstile = installTurnstileMock({ token: 'captcha-token-123' });
    fetchJsonMock.mockRejectedValueOnce(
      new HttpError({
        message: 'Verification failed. Please try again.',
        status: 403,
        code: 'CAPTCHA_INVALID',
        details: { reason: 'verification_failed' },
      }),
    );

    await renderGuestSignInForm();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send magic link/i })).toBeEnabled();
    });

    await user.type(screen.getByPlaceholderText('you@example.com'), 'guest@example.com');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));

    expect(fetchJsonMock).toHaveBeenCalledWith(
      '/api/auth/signin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          mode: 'magic_link',
          email: 'guest@example.com',
          redirectedFrom: '/guest/dashboard',
          captchaToken: 'captcha-token-123',
        }),
      }),
    );

    expect(
      await screen.findByText('Verification failed. Please complete the challenge and try again.'),
    ).toBeInTheDocument();
    expect(turnstile.reset).toHaveBeenCalledTimes(1);
  });

  it('shows validation, success, and cooldown feedback for guest magic-link sign-in', async () => {
    const user = userEvent.setup();
    installTurnstileMock({ token: 'captcha-token-123' });
    fetchJsonMock.mockResolvedValueOnce({
      status: 'magic_link_sent',
      redirectTo: '/bookings/demo-booking',
    });

    await renderGuestSignInForm();

    await user.click(screen.getByRole('button', { name: /send magic link/i }));
    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'guest@example.com');
    await user.click(screen.getByRole('button', { name: /send magic link/i }));

    expect(await screen.findByText('Magic link sent! Check your inbox to finish signing in.')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resend in 60s/i })).toBeDisabled();
    });
  });
});
