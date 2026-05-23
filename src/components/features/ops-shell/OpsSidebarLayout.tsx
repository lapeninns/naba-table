'use client';

import { Info } from 'lucide-react';
import { type ReactNode } from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

// import { OpsOfflineIndicator } from './OpsOfflineIndicator';
import { OpsSidebarPanel } from './OpsSidebarPanel';

type OpsSidebarLayoutProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  headerSlot?: ReactNode;
  envBanner?: string | null;
};

export function OpsSidebarLayout({
  children,
  defaultSidebarOpen = true,
  headerSlot,
  envBanner,
}: OpsSidebarLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen} className="bg-background">
      <OpsSidebarPanel />
      <SidebarRail />
      <SidebarInset className="bg-background">
        <Button
          asChild
          variant="link"
          className="sr-only h-auto p-0 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[40] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow"
        >
          <a href="#ops-content">Skip to content</a>
        </Button>
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-[var(--pg-gutter)] md:hidden">
          <SidebarTrigger className="-ml-1" aria-label="Toggle navigation menu" />
          {headerSlot ? (
            <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
              {headerSlot}
            </div>
          ) : null}
        </div>
        {envBanner ? (
          <Alert
            variant="warning"
            className="mx-4 mt-3 shrink-0 sm:mx-6"
            role="status"
            aria-live="polite"
          >
            <AlertIcon>
              <Info className="size-4" aria-hidden />
            </AlertIcon>
            <AlertTitle>Environment notice</AlertTitle>
            <AlertDescription>{envBanner}</AlertDescription>
          </Alert>
        ) : null}
        {/* <OpsOfflineIndicator /> */}
        <div
          id="ops-content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col overflow-x-hidden"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
