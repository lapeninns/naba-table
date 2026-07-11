import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useOnlineStatusMock, routerRefreshMock } = vi.hoisted(() => ({
  useOnlineStatusMock: vi.fn(() => true),
  routerRefreshMock: vi.fn(),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  default: useOnlineStatusMock,
  useOnlineStatus: useOnlineStatusMock,
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: () => ({ refresh: routerRefreshMock }),
  };
});

import { OpsOfflineIndicator } from '@/components/features/ops-shell/OpsOfflineIndicator';

describe('OpsOfflineIndicator', () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it('@contract renders nothing while the browser is online', () => {
    useOnlineStatusMock.mockReturnValue(true);

    const { container } = render(<OpsOfflineIndicator />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract @a11y announces the offline state via a polite status alert', () => {
    useOnlineStatusMock.mockReturnValue(false);

    render(<OpsOfflineIndicator />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('You are offline')).toBeInTheDocument();
    expect(screen.getByText(/navigation is paused until you reconnect/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('@contract does not refresh the route when retry is clicked while still offline', async () => {
    useOnlineStatusMock.mockReturnValue(false);
    const user = userEvent.setup();

    render(<OpsOfflineIndicator />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(routerRefreshMock).not.toHaveBeenCalled();
  });
});
