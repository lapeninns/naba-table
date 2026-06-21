'use client';

import { ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { type MouseEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { opsHref } from '@/lib/url/opsHref';

import { GbpDriftStatusPill } from './GbpDriftProvider';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

const SETTINGS_EXIT_HREF = opsHref('/dashboard');

type RestaurantSettingsChromeHeaderProps = {
  onExitClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onBreadcrumbParentClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function RestaurantSettingsChromeHeader({
  onBreadcrumbParentClick,
  onExitClick,
}: RestaurantSettingsChromeHeaderProps) {
  const { hasUnsavedChanges } = useOpsUnsavedChanges();
  const { headingContext: heading, restaurantName } = useRestaurantSettingsContext();

  const breadcrumb = heading?.chromeBreadcrumb;

  return (
    <header className="z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
          <Link
            href={SETTINGS_EXIT_HREF}
            aria-label="Close restaurant settings"
            title="Back to dashboard"
            onClick={onExitClick}
          >
            <X className="size-4" aria-hidden />
          </Link>
        </Button>
        <SidebarTrigger
          className="shrink-0 md:hidden"
          aria-label="Toggle restaurant settings navigation"
        />
        <div className="min-w-0 border-l border-border/60 pl-3">
          <p className="text-[0.6875rem] font-medium uppercase leading-4 tracking-wide text-muted-foreground">
            Restaurant settings
          </p>
          {breadcrumb ? (
            <h1 className="flex min-w-0 items-center gap-1 text-sm font-semibold leading-5 text-foreground">
              <Link
                href={breadcrumb.parentHref}
                className="truncate font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={onBreadcrumbParentClick}
              >
                {breadcrumb.parentTitle}
              </Link>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{breadcrumb.leafTitle}</span>
            </h1>
          ) : (
            <h1 className="truncate text-sm font-semibold leading-5 text-foreground">
              {heading?.chromeLeafTitle ?? 'Restaurant settings'}
            </h1>
          )}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {hasUnsavedChanges ? (
          <Badge variant="secondary" className="whitespace-nowrap">
            Unsaved changes
          </Badge>
        ) : null}
        <GbpDriftStatusPill />
        {restaurantName ? (
          <Badge variant="outline" className="max-w-[min(40vw,14rem)] truncate font-medium">
            {restaurantName}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
