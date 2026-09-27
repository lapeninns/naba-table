import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { HttpError } from '@/lib/http/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJson = vi.hoisted(() => vi.fn());
vi.mock('@/lib/http/fetchJson', () => ({ fetchJson }));
import { GbpLiveConnectionPanel } from '@/components/features/restaurant-settings/google-business-profile/components/GbpLiveConnectionPanel';

const blocked = { status: 'blocked', reason: 'retention_not_ready' };
const live = {
  status: 'verified',
  verifiedAt: '2026-09-27T12:00:00.000Z',
  location: {
    title: 'Live restaurant',
    address: '1 Test Street',
    phone: '+441111111111',
    website: 'https://example.test',
  },
  retention: blocked,
};
const checkFailed = vi.fn();
function panel(
  restaurantId = 'restaurant',
  connectionKey = 'connection-1',
  children: ReactNode = <div>Saved comparison workspace</div>,
) {
  return (
    <GbpLiveConnectionPanel
      restaurantId={restaurantId}
      connectionKey={connectionKey}
      onCheckFailed={checkFailed}
      savedStatus="sync_error"
      operations={<button>Disconnect Google</button>}
    >
      {children}
    </GbpLiveConnectionPanel>
  );
}
function SavedDecisions() {
  const [decision, setDecision] = useState('');
  return (
    <input
      aria-label="Saved decision"
      value={decision}
      onChange={(event) => setDecision(event.target.value)}
    />
  );
}

describe('live GBP panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchJson.mockImplementation(async (url: string) =>
      url.endsWith('/readiness') ? blocked : live,
    );
  });
  it('uses an explicit uncached read, shows genuine live fields while saved sync stays blocked', async () => {
    const user = userEvent.setup();
    render(panel());
    await screen.findByText('Saved comparison unavailable');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Live restaurant')).not.toBeInTheDocument();
    expect(screen.queryByText('Saved comparison workspace')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect Google' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check live connection' }));
    expect(await screen.findByText('Live restaurant')).toBeInTheDocument();
    expect(screen.getByText('Live connection verified')).toBeInTheDocument();
    expect(screen.getByText('1 Test Street')).toBeInTheDocument();
    expect(screen.getByText('+441111111111')).toBeInTheDocument();
    expect(screen.getByText('https://example.test')).toBeInTheDocument();
    expect(
      screen.getByText(/Saved sync failed; any prior comparison may be out of date/),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not enable imports or publishing/)).toBeInTheDocument();
    expect(fetchJson).toHaveBeenLastCalledWith(
      expect.stringContaining('/restaurant/google-business-profile/live'),
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    );
  });
  it('discards a previous successful result immediately when a new check fails', async () => {
    const user = userEvent.setup();
    render(panel());
    await user.click(await screen.findByRole('button', { name: 'Check live connection' }));
    await screen.findByText('Live restaurant');
    fetchJson.mockRejectedValueOnce(new Error('private provider detail'));
    await user.click(screen.getByRole('button', { name: 'Check live connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not verify the live Google connection',
    );
    expect(screen.queryByText('Live restaurant')).not.toBeInTheDocument();
    expect(screen.queryByText('Live connection verified')).not.toBeInTheDocument();
    expect(screen.queryByText('private provider detail')).not.toBeInTheDocument();
  });
  it('discards late response after tenant switch and aborts the old request', async () => {
    const user = userEvent.setup();
    let finish: ((value: unknown) => void) | undefined;
    fetchJson.mockImplementation(async (url: string) =>
      url.endsWith('/readiness')
        ? blocked
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const view = render(panel());
    await user.click(await screen.findByRole('button', { name: 'Check live connection' }));
    const oldSignal = fetchJson.mock.calls.at(-1)?.[1].signal;
    view.rerender(panel('other-tenant'));
    expect(oldSignal.aborted).toBe(true);
    finish?.(live);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Check live connection' })).toBeEnabled(),
    );
    expect(screen.queryByText('Live restaurant')).not.toBeInTheDocument();
  });
  it.each([401, 403])(
    'refreshes connection state after a provider access failure %i',
    async (status) => {
      const user = userEvent.setup();
      render(panel());
      await screen.findByText('Saved comparison unavailable');
      fetchJson.mockRejectedValueOnce(
        new HttpError({ status, message: 'private provider detail' }),
      );
      await user.click(screen.getByRole('button', { name: 'Check live connection' }));
      await screen.findByRole('alert');
      expect(checkFailed).toHaveBeenCalledTimes(1);
      expect(checkFailed).toHaveBeenCalledWith();
    },
  );
  it('preserves saved decisions and readiness while operator fencing changes reset only live data', async () => {
    const user = userEvent.setup();
    fetchJson.mockImplementation(async (url: string) =>
      url.endsWith('/readiness')
        ? { status: 'ready', reason: null }
        : { ...live, retention: { status: 'ready', reason: null } },
    );
    const view = render(panel('restaurant', 'operator-loading', <SavedDecisions />));
    await user.type(await screen.findByRole('textbox', { name: 'Saved decision' }), 'Keep ours');
    view.rerender(panel('restaurant', 'generation-1:epoch-1:eligible', <SavedDecisions />));
    expect(screen.getByRole('textbox', { name: 'Saved decision' })).toHaveValue('Keep ours');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('Connection diagnostics'));
    await user.click(screen.getByRole('button', { name: 'Check live connection' }));
    await screen.findByText('Live restaurant');
    view.rerender(panel('restaurant', 'generation-1:epoch-2:blocked', <SavedDecisions />));
    expect(screen.getByRole('textbox', { name: 'Saved decision' })).toHaveValue('Keep ours');
    expect(screen.queryByText('Live restaurant')).not.toBeInTheDocument();
    expect(screen.queryByText('Live connection verified')).not.toBeInTheDocument();
    expect(fetchJson.mock.calls.filter(([url]) => url.endsWith('/readiness'))).toHaveLength(1);
  });
  it('aborts a late live response on connection change without discarding saved decisions or refreshing state', async () => {
    const user = userEvent.setup();
    let finish: ((value: unknown) => void) | undefined;
    fetchJson.mockImplementation(async (url: string) =>
      url.endsWith('/readiness')
        ? { status: 'ready', reason: null }
        : new Promise((resolve) => {
            finish = resolve;
          }),
    );
    const view = render(panel('restaurant', 'before', <SavedDecisions />));
    await user.type(await screen.findByRole('textbox', { name: 'Saved decision' }), 'Keep ours');
    await user.click(screen.getByText('Connection diagnostics'));
    await user.click(screen.getByRole('button', { name: 'Check live connection' }));
    const oldSignal = fetchJson.mock.calls.at(-1)?.[1].signal;
    view.rerender(panel('restaurant', 'after', <SavedDecisions />));
    expect(oldSignal.aborted).toBe(true);
    finish?.(live);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Check live connection' })).toBeEnabled(),
    );
    expect(screen.getByRole('textbox', { name: 'Saved decision' })).toHaveValue('Keep ours');
    expect(screen.queryByText('Live restaurant')).not.toBeInTheDocument();
    expect(checkFailed).not.toHaveBeenCalled();
  });
  it('does not call a valid prior comparison unavailable solely because the last sync failed', async () => {
    fetchJson.mockResolvedValue({ status: 'ready', reason: null });
    render(panel());
    await screen.findByText('Saved comparison workspace');
    expect(
      screen.getByText(/Saved sync failed; any prior comparison may be out of date/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/unavailable after a failed sync/)).not.toBeInTheDocument();
  });
  it('preserves the saved comparison workspace when readiness is current', async () => {
    fetchJson.mockResolvedValue({ status: 'ready', reason: null });
    render(panel());
    expect(await screen.findByText('Saved comparison workspace')).toBeInTheDocument();
    expect(screen.queryByText('Live connection verified')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check live connection' })).not.toBeVisible();
  });
});
