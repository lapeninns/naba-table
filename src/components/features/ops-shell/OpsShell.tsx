'use client';

import type { ReactNode } from 'react';

import { SidebarProvider, SidebarRail } from '@/components/ui/sidebar';

import { OpsSidebar, OpsSidebarInset } from './OpsSidebar';

type OpsShellProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
};

export function OpsShell({ children, defaultSidebarOpen }: OpsShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="bg-background">
      <OpsSidebar />
      <SidebarRail />
      <OpsSidebarInset>
        <a
          href="#ops-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow"
        >
          Skip to content
        </a>
        <div id="ops-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </OpsSidebarInset>
    </SidebarProvider>
  );
}
