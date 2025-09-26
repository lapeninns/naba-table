'use client';

import { Outlet } from 'react-router-dom';

import { ReserveProviders } from '@app/providers';

export function ReserveRootLayout() {
  return (
    <ReserveProviders>
      <a href="#reserve-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <div id="reserve-content">
        <Outlet />
      </div>
    </ReserveProviders>
  );
}
