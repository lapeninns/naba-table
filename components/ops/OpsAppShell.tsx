'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AppSidebar } from '@/components/ops/AppSidebar';
import { Button } from '@/components/ui/button';
import {
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

type OpsAppShellProps = {
  children: ReactNode;
  defaultOpen?: boolean;
};

const TITLE_MAP: Array<{ match: (pathname: string) => boolean; title: string }> = [
  { match: (pathname) => pathname === '/ops', title: "Today's service overview" },
  { match: (pathname) => pathname.startsWith('/ops/bookings/new'), title: 'Record walk-in booking' },
  { match: (pathname) => pathname.startsWith('/ops/bookings'), title: 'Manage bookings' },
  { match: (pathname) => pathname.startsWith('/ops/manage-restaurant'), title: 'Manage restaurant settings' },
  { match: (pathname) => pathname.startsWith('/ops/team'), title: 'Manage team and invites' },
];

function resolveTitle(pathname: string | null): string {
  if (!pathname) return 'Operations';
  const fallback = 'Operations';
  const matched = TITLE_MAP.find((entry) => entry.match(pathname));
  return matched ? matched.title : fallback;
}

export function OpsAppShell({ children, defaultOpen }: OpsAppShellProps) {
  const pathname = usePathname();
  const pageTitle = resolveTitle(pathname);

  const isOnWalkInPage = pathname?.startsWith('/ops/bookings/new') ?? false;

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="bg-background">
      <AppSidebar />
      <SidebarRail />
      <SidebarInset className="bg-background">
        <a
          href="#ops-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow"
        >
          Skip to content
        </a>

        <header className="sticky inset-x-0 top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/65">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="size-9 touch-manipulation md:size-8" />
              <div className="flex flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  SajiloReserveX Ops
                </span>
                <h1 className="text-base font-semibold leading-tight text-foreground sm:text-lg">
                  {pageTitle}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isOnWalkInPage ? (
                <Button asChild size="sm" className="touch-manipulation">
                  <Link href="/ops/bookings/new">New walk-in booking</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div id="ops-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
