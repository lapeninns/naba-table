import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
function panel(restaurantId = 'restaurant') {
  return (
    <GbpLiveConnectionPanel
      restaurantId={restaurantId}
      connectionKey="connection-1"
      savedStatus="sync_error"
      operations={<button>Disconnect Google</button>}
    >
      <div>Saved comparison workspace</div>
    </GbpLiveConnectionPanel>
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
      screen.getByText(/Saved comparison: unavailable after a failed sync/),
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
  it('preserves the saved comparison workspace when readiness is current', async () => {
    fetchJson.mockResolvedValue({ status: 'ready', reason: null });
    render(panel());
    expect(await screen.findByText('Saved comparison workspace')).toBeInTheDocument();
    expect(screen.queryByText('Live connection verified')).not.toBeInTheDocument();
  });
});
