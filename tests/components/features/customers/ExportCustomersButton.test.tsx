import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorMock = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));

import { ExportCustomersButton } from '@/components/features/customers/ExportCustomersButton';
import { DEFAULT_ERROR_COPY } from '@/lib/http/userMessage';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function renderButton() {
  render(<ExportCustomersButton restaurantId={RESTAURANT_ID} restaurantName="The Fox" />);
  return screen.getByRole('button', { name: 'Export guests to CSV' });
}

describe('ExportCustomersButton', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    toastErrorMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the server message for a failed export (403)', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'You can’t export guests for this venue.',
          code: 'FORBIDDEN',
          message: 'You can’t export guests for this venue.',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    );
    await userEvent.click(renderButton());

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('You can’t export guests for this venue.'),
    );
    expect(screen.getByRole('button', { name: 'Export guests to CSV' })).toBeEnabled();
  });

  it('never shows a raw 5xx body and falls back to server copy', async () => {
    fetchMock.mockResolvedValue(new Response('upstream exploded: pg error', { status: 502 }));
    await userEvent.click(renderButton());

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(DEFAULT_ERROR_COPY.server));
  });

  it('reports a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await userEvent.click(renderButton());

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(DEFAULT_ERROR_COPY.network));
  });
});
