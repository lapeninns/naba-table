import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());
const scriptProps = vi.hoisted(() => ({ current: null as null | { onError?: () => void } }));

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: fetchJsonMock }));
vi.mock('next/script', () => ({
  default: (props: { onError?: () => void; onLoad?: () => void }) => {
    scriptProps.current = props;
    return null;
  },
}));

type RenderConfig = {
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
};

function installTurnstileMock() {
  const configs: RenderConfig[] = [];
  const render = vi.fn((_: HTMLElement, config: RenderConfig) => {
    configs.push(config);
    return 'widget-1';
  });
  const reset = vi.fn();
  (window as { turnstile?: unknown }).turnstile = { render, reset };
  return { render, reset, configs };
}

async function renderForm() {
  const { FindBookingForm } = await import('@/components/features/booking/find/FindBookingForm');
  return render(
    <FindBookingForm venues={[{ slug: 'the-fox', name: 'The Fox' }]} initialVenueSlug="the-fox" />,
  );
}

const originalSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

describe('FindBookingForm security check failures', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchJsonMock.mockReset();
    scriptProps.current = null;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key';
  });

  afterEach(() => {
    if (typeof originalSiteKey === 'string') {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalSiteKey;
    } else {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    }
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it('explains a blocked Turnstile script and offers a retry', async () => {
    await renderForm();
    expect(scriptProps.current?.onError).toBeTypeOf('function');
    act(() => scriptProps.current?.onError?.());

    expect(screen.getByText(/security check didn’t load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try the check again' })).toBeInTheDocument();
  });

  it('explains a widget error and the retry resets the widget', async () => {
    const user = userEvent.setup();
    const turnstile = installTurnstileMock();
    await renderForm();
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled());

    act(() => turnstile.configs[0]?.['error-callback']?.());
    expect(screen.getByText(/security check didn’t load/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try the check again' }));
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(screen.queryByText(/security check didn’t load/i)).not.toBeInTheDocument();
  });

  it('keeps submit enabled without a token and says what to do on submit', async () => {
    const user = userEvent.setup();
    installTurnstileMock();
    await renderForm();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'guest@example.com');
    const submit = screen.getByRole('button', { name: 'Email me a link' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(screen.getByText('Complete the check to continue.')).toBeInTheDocument();
    expect(fetchJsonMock).not.toHaveBeenCalled();
  });

  it('shows the not-configured copy, not a success, when links are unavailable', async () => {
    const user = userEvent.setup();
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    // After resetModules the form loads a fresh errors module; build the error from it.
    const { HttpError } = await import('@/lib/http/errors');
    fetchJsonMock.mockRejectedValueOnce(
      new HttpError({
        message: 'Booking links are temporarily unavailable.',
        status: 503,
        code: 'BOOKING_LINKS_UNAVAILABLE',
      }),
    );
    await renderForm();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'guest@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a link' }));

    expect(
      await screen.findByText(/contact the venue to manage your booking/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('find-booking-accepted')).not.toBeInTheDocument();
  });
});
