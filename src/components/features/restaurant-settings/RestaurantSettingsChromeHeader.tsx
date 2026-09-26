'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type MouseEvent } from 'react';

import {
  OPS_CHROME_MIN_HEIGHT_CLASS,
  OPS_SHELL_GUTTER_X_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { normalizeOpsPathname, opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { GbpDriftStatusPill } from './GbpDriftProvider';
import { RESTAURANT_SETTINGS_OVERVIEW_ROUTE, RESTAURANT_SETTINGS_ROUTE_MAP } from './routes';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';

const SETTINGS_EXIT_HREF = opsHref('/dashboard');
const SETTINGS_ROOT_LABEL = 'Settings';
const FALLBACK_TITLE = 'Restaurant settings';
const GBP_ROUTE_HREF = normalizeOpsPathname(
  RESTAURANT_SETTINGS_ROUTE_MAP['google-business-profile'].href,
);

type RestaurantSettingsChromeHeaderProps = {
  onExitClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Guards every ancestor link (settings root and parent section) against unsaved changes. */
  onBreadcrumbParentClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Explicit page title (legacy routes, dev harnesses) when the pathname has no route copy. */
  title?: string;
};

/**
 * Focused-mode chrome for restaurant settings: one 48px row that owns the page's only h1.
 *
 * Mobile-first order: navigation trigger → title (wraps to two lines before truncating) →
 * status → close. From `md` the title is preceded by a `Settings /` breadcrumb that leads back
 * to Restaurant setup; phones reach it through the navigation sheet instead.
 */
export function RestaurantSettingsChromeHeader({
  onBreadcrumbParentClick,
  onExitClick,
  title,
}: RestaurantSettingsChromeHeaderProps) {
  const { hasUnsavedChanges } = useOpsUnsavedChanges();
  const { headingContext: heading, pathname, restaurantName } = useRestaurantSettingsContext();
  const { isMobile, openMobile, state: sidebarState } = useSidebar();
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const wasNavSheetOpen = useRef(false);

  // The phone nav sheet is opened by state, not a Radix trigger, so Radix cannot restore focus
  // on Escape or overlay dismiss. Return it to the menu button so keyboard users keep their place.
  useEffect(() => {
    if (wasNavSheetOpen.current && !openMobile && isMobile) {
      navTriggerRef.current?.focus();
    }
    wasNavSheetOpen.current = openMobile;
  }, [isMobile, openMobile]);

  const normalizedPathname = pathname ? normalizeOpsPathname(pathname) : null;
  const overviewHref = RESTAURANT_SETTINGS_OVERVIEW_ROUTE.href;
  const isOverview = normalizedPathname === normalizeOpsPathname(overviewHref);
  const isGbpRoute =
    normalizedPathname != null &&
    (normalizedPathname === GBP_ROUTE_HREF || normalizedPathname.startsWith(`${GBP_ROUTE_HREF}/`));

  const pageTitle = title ?? heading?.chromeLeafTitle ?? FALLBACK_TITLE;
  const showRoot = !isOverview && pageTitle !== FALLBACK_TITLE;
  // The expanded sidebar names the restaurant; surface it here only when the rail hides it.
  const showRestaurantName = Boolean(restaurantName) && !isMobile && sidebarState === 'collapsed';

  return (
    <header
      data-slot="settings-chrome"
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border/60 bg-background py-1 sm:gap-3',
        OPS_CHROME_MIN_HEIGHT_CLASS,
        OPS_SHELL_GUTTER_X_CLASS,
      )}
    >
      <SidebarTrigger
        ref={navTriggerRef}
        className="relative -ml-2 size-9 shrink-0 after:absolute after:-inset-1 md:hidden"
        aria-label="Toggle restaurant settings navigation"
      />

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {showRoot ? (
          <Breadcrumb aria-label="Breadcrumb" className="hidden shrink-0 md:flex">
            <BreadcrumbList className="flex-nowrap gap-1.5 text-sm leading-5 sm:gap-1.5">
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="font-medium">
                  <Link href={overviewHref} onClick={onBreadcrumbParentClick}>
                    {SETTINGS_ROOT_LABEL}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
        <h1
          className="line-clamp-2 min-w-0 break-words text-sm font-semibold leading-5 text-foreground sm:line-clamp-1 sm:text-base sm:leading-6"
          title={pageTitle}
        >
          {pageTitle}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showRestaurantName ? (
          <span
            className="hidden max-w-48 truncate text-xs font-medium text-muted-foreground md:inline"
            title={restaurantName ?? undefined}
          >
            {restaurantName}
          </span>
        ) : null}
        {hasUnsavedChanges ? (
          <Badge variant="status-pending" className="whitespace-nowrap">
            <span className="sm:hidden">Unsaved</span>
            <span className="hidden sm:inline">Unsaved changes</span>
          </Badge>
        ) : null}
        {/* Phones get Google status from the in-page strip; the GBP route is the status itself. */}
        {isGbpRoute ? null : <GbpDriftStatusPill className="hidden h-8 md:inline-flex" />}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="relative -mr-2 ml-1 shrink-0 after:absolute after:-inset-1 lg:w-auto lg:px-3"
        >
          <Link
            href={SETTINGS_EXIT_HREF}
            aria-label="Close restaurant settings"
            title="Back to dashboard"
            onClick={onExitClick}
          >
            <X className="size-4" aria-hidden />
            <span className="hidden lg:inline">Close</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
