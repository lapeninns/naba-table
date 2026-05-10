'use client';

import { Outlet } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ReserveProviders } from '@app/providers';

export function ReserveRootLayout() {
  return (
    <ReserveProviders>
      <Button variant="link" className="sr-only h-auto p-0 focus:not-sr-only" asChild>
        <a href="#reserve-content">Skip to content</a>
      </Button>
      <div id="reserve-content">
        <Outlet />
      </div>
    </ReserveProviders>
  );
}
