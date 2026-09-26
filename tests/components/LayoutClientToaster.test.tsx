import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pathnameMock = vi.fn(() => '/app');

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('../../components/auth/ImplicitAuthHandler', () => ({
  ImplicitAuthHandler: () => null,
}));

vi.mock('../../components/ui/sonner', () => ({
  Toaster: () => <div data-testid="global-toaster" />,
}));

import ClientLayout from '../../components/LayoutClient';

describe('ClientLayout toaster', () => {
  afterEach(() => {
    pathnameMock.mockReset();
  });

  it.each(['/app', '/app/seating/floor-plan', '/guest/dashboard', '/'])(
    'mounts exactly one global Toaster on %s',
    (pathname) => {
      pathnameMock.mockReturnValue(pathname);
      const { getAllByTestId } = render(
        <ClientLayout>
          <p>page</p>
        </ClientLayout>,
      );

      expect(getAllByTestId('global-toaster')).toHaveLength(1);
    },
  );

  it.each(['/auth/signin', '/app/auth/signin', '/auth/signup'])(
    'mounts no Toaster on the inline-error auth route %s',
    (pathname) => {
      pathnameMock.mockReturnValue(pathname);
      const { queryAllByTestId } = render(
        <ClientLayout>
          <p>page</p>
        </ClientLayout>,
      );

      expect(queryAllByTestId('global-toaster')).toHaveLength(0);
    },
  );
});
