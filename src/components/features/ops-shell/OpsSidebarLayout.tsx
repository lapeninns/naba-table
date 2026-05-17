'use client';

import { Info, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { Alert, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { signOutFromSupabase } from '@/lib/supabase/signOut';
import { cn } from '@/lib/utils';

import { OPS_SUPPORT_ITEM, filterOpsNavigationSections, isNavItemActive } from './navigation';
// import { OpsOfflineIndicator } from './OpsOfflineIndicator';
import { OpsRestaurantSwitch } from './OpsRestaurantSwitch';
import { useOpsRoutePrefetch } from './useOpsRoutePrefetch';

import type { OpsNavigationSection } from './navigation';

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
          <div className="flex h-12 items-center gap-3 border-b border-border/60 px-[var(--pg-gutter)]">
            <SidebarTrigger className="-ml-1" aria-label="Toggle navigation menu" />
            {headerSlot ? (
              <div className="flex-1 truncate text-sm font-medium text-muted-foreground">
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

function OpsSidebarPanel() {
  const pathname = usePathname();
  const { featureFlags, permissions } = useOpsSession();

  const sections = useMemo<OpsNavigationSection[]>(() => {
    return filterOpsNavigationSections({
      featureFlags,
      canViewAdminItems: permissions.canManageSettings,
    });
  }, [featureFlags, permissions.canManageSettings]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OpsRestaurantSwitch />
      </SidebarHeader>
      <SidebarContent>
        {!pathname ? (
          <OpsSidebarSkeleton />
        ) : (
          <OpsSidebarNav sections={sections} pathname={pathname} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <OpsAccountActions />
        <SidebarSeparator />
        <OpsSupportLink />
      </SidebarFooter>
    </Sidebar>
  );
}

function OpsSidebarNav({
  sections,
  pathname,
}: {
  sections: OpsNavigationSection[];
  pathname: string;
}) {
  const isOnline = useOnlineStatus();
  const { confirmNavigation } = useOpsUnsavedChanges();
  const prefetchRoute = useOpsRoutePrefetch();

  // Debounce hover/focus prefetch so quick pointer passes do not trigger
  // network work. Click navigation goes through `<Link>` directly and is
  // unaffected by this timer.
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };
  }, []);
  const schedulePrefetch = useCallback(
    (href: string) => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
      prefetchTimerRef.current = setTimeout(() => {
        prefetchTimerRef.current = null;
        prefetchRoute(href);
      }, 200);
    },
    [prefetchRoute],
  );

  const handleOfflineNavigation = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (isOnline) return;
      event.preventDefault();
    },
    [isOnline],
  );

  const handleNavigationIntent = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isOnline) {
        event.preventDefault();
        return;
      }

      if (!confirmNavigation()) {
        event.preventDefault();
      }
    },
    [confirmNavigation, isOnline],
  );

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <SidebarGroup key={section.label ?? `section-${sectionIndex}`}>
          {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(!isOnline && 'opacity-60')}
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        aria-disabled={!isOnline}
                        onMouseEnter={() => schedulePrefetch(item.href)}
                        onFocus={() => schedulePrefetch(item.href)}
                        onClick={(event) => {
                          handleOfflineNavigation(event);
                          if (!event.defaultPrevented) {
                            handleNavigationIntent(event);
                          }
                        }}
                      >
                        <Icon aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function OpsSidebarSkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Loading</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Array.from({ length: 5 }).map((_, index) => (
            <SidebarMenuItem key={`ops-sidebar-skeleton-${index}`}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function OpsAccountActions() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { confirmNavigation } = useOpsUnsavedChanges();

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    if (
      !confirmNavigation('You have unsaved changes in this workspace. Log out and discard them?')
    ) {
      return;
    }
    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      // Use hard redirect to ensure all client-side state is completely cleared
      // This prevents redirect loops caused by stale React Query cache or React state
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('[ops-sidebar] sign out failed', error);
      setIsSigningOut(false);
    }
    // Note: We don't reset isSigningOut on success since we're navigating away
  }, [confirmNavigation, isSigningOut]);

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Account</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Sign out of operations"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="size-4" aria-hidden />
              )}
              <span className="truncate">{isSigningOut ? 'Signing out…' : 'Log out'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function OpsSupportLink() {
  const SupportIcon = OPS_SUPPORT_ITEM.icon;

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Need help?</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Contact Nab a Table support">
              <a href={OPS_SUPPORT_ITEM.href}>
                <SupportIcon aria-hidden />
                <span className="truncate">{OPS_SUPPORT_ITEM.title}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
