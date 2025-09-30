import { render } from '@testing-library/react';
import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserRouterMock = vi.fn(() => ({}));
const routerProviderSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) as Record<string, unknown>;
  return {
    ...actual,
    createBrowserRouter: createBrowserRouterMock,
    RouterProvider: ({ router }: { router: unknown }): ReactElement | null => {
      routerProviderSpy(router);
      return null;
    },
  };
});

const originalEnv = { ...process.env };

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
};

describe('ReserveRouter', () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserRouterMock.mockClear();
    routerProviderSpy.mockClear();
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it('uses the default /reserve basename when no override is provided', async () => {
    const { ReserveRouter } = await import('../router');

    render(<ReserveRouter />);

    expect(createBrowserRouterMock).toHaveBeenCalledWith(expect.any(Array), {
      basename: '/reserve',
    });
  });

  it('normalizes custom base paths from the environment', async () => {
    process.env.RESERVE_ROUTER_BASE_PATH = 'reservations/v2/';

    const { ReserveRouter } = await import('../router');

    render(<ReserveRouter />);

    expect(createBrowserRouterMock).toHaveBeenCalledWith(expect.any(Array), {
      basename: '/reservations/v2',
    });
  });
});
