'use client';

import { Loader2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

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
import { signOutFromSupabase } from '@/lib/supabase/signOut';

import { OPS_NAV_SECTIONS, OPS_SUPPORT_ITEM, isNavItemActive } from './navigation';
import { OpsOfflineIndicator } from './OpsOfflineIndicator';
import { OpsRestaurantSwitch } from './OpsRestaurantSwitch';

import type { OpsNavigationSection } from './navigation';

type OpsSidebarLayoutProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  headerSlot?: ReactNode;
};

export function OpsSidebarLayout({ children, defaultSidebarOpen = true, headerSlot }: OpsSidebarLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <OpsSidebarPanel />
      <SidebarRail />
      <SidebarInset>
        <div className="flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          {headerSlot ? (
            <div className="flex-1 truncate text-sm font-medium text-muted-foreground">{headerSlot}</div>
          ) : null}
        </div>
        <OpsOfflineIndicator />
        <div className="flex flex-1 flex-col overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function OpsSidebarPanel() {
  const pathname = usePathname();
  const { featureFlags } = useOpsSession();

  const sections = useMemo<OpsNavigationSection[]>(() => {
    return OPS_NAV_SECTIONS.map((section) => ({
      label: section.label,
      items: section.items.filter((item) =>
        item.requiresFeatureFlag ? Boolean(featureFlags[item.requiresFeatureFlag]) : true,
      ),
    })).filter((section) => section.items.length > 0);
  }, [featureFlags]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OpsRestaurantSwitch />
      </SidebarHeader>
      <SidebarContent>
        {!pathname ? <OpsSidebarSkeleton /> : <OpsSidebarNav sections={sections} pathname={pathname} />}
      </SidebarContent>
      <SidebarFooter>
        <OpsAccountActions />
        <SidebarSeparator className="my-4" />
        <OpsSupportLink />
      </SidebarFooter>
    </Sidebar>
  );
}

function OpsSidebarNav({ sections, pathname }: { sections: OpsNavigationSection[]; pathname: string }) {
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label} className="gap-1">
          <SidebarGroupLabel className="text-[0.68rem] uppercase tracking-wide">{section.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        prefetch={false}
                      >
                        <Icon aria-hidden className="size-4" />
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
    <SidebarGroup className="gap-2">
      <SidebarGroupLabel className="text-[0.68rem] uppercase tracking-wide text-sidebar-foreground/50">
        Loading
      </SidebarGroupLabel>
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
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      router.push('/auth/signin');
      router.refresh();
    } catch (error) {
      console.error('[ops-sidebar] sign out failed', error);
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, router]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Account</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign out of operations">
              <button
                type="button"
                className="flex w-full items-center gap-2 touch-manipulation"
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
              </button>
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
    <SidebarGroup>
      <SidebarGroupLabel>Need help?</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Contact Nab a Table support" className="touch-manipulation">
              <a href={OPS_SUPPORT_ITEM.href}>
                <SupportIcon className="size-4" aria-hidden />
                <span className="truncate">{OPS_SUPPORT_ITEM.title}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
