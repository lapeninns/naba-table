import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDualSyncReconnectAction } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncReconnectAction';

const mocks = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
  },
  useOpsGoogleBusinessProfileConnection: vi.fn(),
  useOpsStartGoogleBusinessProfileAuthorization: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: mocks.useOpsGoogleBusinessProfileConnection,
  useOpsStartGoogleBusinessProfileAuthorization:
    mocks.useOpsStartGoogleBusinessProfileAuthorization,
}));

vi.mock('sonner', () => ({
  toast: mocks.toast,
}));

function renderReconnectAction(redirectToAuthorizationUrl = vi.fn()) {
  return renderHook(() =>
    useDualSyncReconnectAction({
      restaurantId: 'restaurant-1',
      redirectToAuthorizationUrl,
    }),
  );
}

beforeEach(() => {
  mocks.toast.error.mockReset();
  mocks.useOpsGoogleBusinessProfileConnection.mockReset();
  mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReset();
  mocks.useOpsGoogleBusinessProfileConnection.mockReturnValue({
    data: {
      status: 'linked',
    },
  });
  mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReturnValue({
    isPending: false,
    mutate: vi.fn(),
  });
});

describe('useDualSyncReconnectAction', () => {
  it('derives reauth and pending state from the GBP hooks', () => {
    const mutate = vi.fn();
    mocks.useOpsGoogleBusinessProfileConnection.mockReturnValue({
      data: {
        status: 'reauth_required',
      },
    });
    mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReturnValue({
      isPending: true,
      mutate,
    });

    const { result } = renderReconnectAction();

    expect(mocks.useOpsGoogleBusinessProfileConnection).toHaveBeenCalledWith('restaurant-1');
    expect(mocks.useOpsStartGoogleBusinessProfileAuthorization).toHaveBeenCalledWith(
      'restaurant-1',
    );
    expect(result.current.needsReauth).toBe(true);
    expect(result.current.isReconnectPending).toBe(true);
  });

  it('does not start authorization while reconnect is pending', () => {
    const mutate = vi.fn();
    mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReturnValue({
      isPending: true,
      mutate,
    });

    const { result } = renderReconnectAction();

    act(() => result.current.handleReconnect());

    expect(mutate).not.toHaveBeenCalled();
  });

  it('starts authorization and redirects on success', () => {
    const mutate = vi.fn();
    const redirectToAuthorizationUrl = vi.fn();
    mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReturnValue({
      isPending: false,
      mutate,
    });

    const { result } = renderReconnectAction(redirectToAuthorizationUrl);

    act(() => result.current.handleReconnect());

    expect(mutate).toHaveBeenCalledWith(undefined, {
      onError: expect.any(Function),
      onSuccess: expect.any(Function),
    });

    const [, options] = mutate.mock.calls[0] as [
      undefined,
      {
        onError: (error: Error) => void;
        onSuccess: (result: { authorizationUrl: string }) => void;
      },
    ];

    act(() => options.onSuccess({ authorizationUrl: 'https://accounts.google.test/oauth' }));

    expect(redirectToAuthorizationUrl).toHaveBeenCalledWith('https://accounts.google.test/oauth');
  });

  it('shows the authorization error message when reconnect fails', () => {
    const mutate = vi.fn();
    mocks.useOpsStartGoogleBusinessProfileAuthorization.mockReturnValue({
      isPending: false,
      mutate,
    });

    const { result } = renderReconnectAction();

    act(() => result.current.handleReconnect());

    const [, options] = mutate.mock.calls[0] as [
      undefined,
      {
        onError: (error: Error) => void;
        onSuccess: (result: { authorizationUrl: string }) => void;
      },
    ];

    act(() => options.onError(new Error('Reconnect failed')));

    expect(mocks.toast.error).toHaveBeenCalledWith('Reconnect failed');
  });
});
