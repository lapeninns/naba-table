'use client';

import type { ReactNode } from 'react';

import { AppSidebar, type OpsSidebarAccount } from '@/components/ops/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarRail } from '@/components/ui/sidebar';

type OpsAppShellProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  account?: OpsSidebarAccount | null;
};

export function OpsAppShell({ children, defaultOpen, account }: OpsAppShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} className="bg-background">
      <AppSidebar account={account} />
      <SidebarRail />
      <SidebarInset id="main-content" tabIndex={-1} className="bg-background">
        <a
          href="#ops-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow"
        >
          Skip to content
        </a>

        <div id="ops-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
