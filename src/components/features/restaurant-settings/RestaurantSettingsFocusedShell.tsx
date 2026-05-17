'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type MouseEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { RestaurantSettingsSubnav } from './RestaurantSettingsSubnav';
import { SETTINGS_COMPACT_PAGE_CONTENT_CLASS } from './shared';

export type RestaurantSettingsFocusedShellProps = {
  children: ReactNode;
  envBanner?: string | null;
};

const SETTINGS_EXIT_HREF = opsHref('/dashboard');

export function RestaurantSettingsFocusedShell({
  children,
  envBanner,
}: RestaurantSettingsFocusedShellProps) {
  const { confirmNavigation } = useOpsUnsavedChanges();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();

  const restaurantName = useMemo(() => {
    return (
      activeMembership?.restaurantName ??
      memberships.find((membership) => membership.restaurantId === activeRestaurantId)
        ?.restaurantName ??
      memberships[0]?.restaurantName ??
      null
    );
  }, [activeMembership?.restaurantName, activeRestaurantId, memberships]);
  const handleExitClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4 sm:px-6">
        <Button asChild variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
          <Link
            href={SETTINGS_EXIT_HREF}
            aria-label="Close restaurant settings"
            onClick={handleExitClick}
          >
            <X className="size-4" aria-hidden />
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <p className="min-w-0 truncate text-sm font-medium text-foreground">Restaurant settings</p>
        {restaurantName ? (
          <p className="ml-auto hidden max-w-[min(40vw,16rem)] truncate text-xs text-muted-foreground sm:block">
            {restaurantName}
          </p>
        ) : null}
      </header>

      {envBanner ? (
        <p
          className="border-b border-border/60 bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground sm:px-6"
          role="status"
        >
          {envBanner}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-border/60 bg-muted/15 lg:w-72 lg:border-b-0 lg:border-r">
          <RestaurantSettingsSubnav
            variant="focused"
            className="lg:sticky lg:top-14 lg:max-h-[calc(100svh-3.5rem)]"
          />
        </aside>
        <main
          id="ops-content"
          tabIndex={-1}
          className={cn(
            'min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:py-8',
            SETTINGS_COMPACT_PAGE_CONTENT_CLASS,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
