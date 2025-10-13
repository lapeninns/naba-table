'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

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
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { signOutFromSupabase } from '@/lib/supabase/signOut';
import { cn } from '@/lib/utils';
import { useOpsSession } from '@/contexts/ops-session';

import { OpsRestaurantSwitch } from './OpsRestaurantSwitch';
import { OPS_NAV_SECTIONS, OPS_SUPPORT_ITEM, isNavItemActive } from './navigation';

type OpsSidebarProps = {
  collapsible?: 'icon' | 'none';
};

export function OpsSidebar({ collapsible = 'icon' }: OpsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeMembership } = useOpsSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const SupportIcon = OPS_SUPPORT_ITEM.icon;

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      router.push('/signin');
      router.refresh();
    } catch (error) {
      console.error('[ops-shell] sign out failed', error);
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, router]);

  if (!pathname) {
    return (
      <Sidebar collapsible={collapsible}>
        <SidebarContent className="px-2 py-3">
          <SidebarMenu>
            {Array.from({ length: 3 }).map((_, index) => (
              <SidebarMenuItem key={`skeleton-${index}`}>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible={collapsible}>
      <SidebarHeader className="px-3 pt-4">
        <OpsRestaurantSwitch />
      </SidebarHeader>

      <SidebarContent>
        {OPS_NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isNavItemActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className="touch-manipulation"
                        >
                          <Icon
                            className={cn(
                              'size-4 transition-colors group-hover/menu-button:text-sidebar-accent-foreground group-focus-visible/menu-button:text-sidebar-accent-foreground',
                              active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground',
                            )}
                            aria-hidden
                          />
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
      </SidebarContent>

      <SidebarSeparator className="mx-2" />

      <SidebarFooter className="space-y-4 pb-4">
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  className="touch-manipulation"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  aria-busy={isSigningOut}
                >
                  {isSigningOut ? (
                    <Loader2 className="size-4 animate-spin text-sidebar-foreground" aria-hidden />
                  ) : (
                    <LogOut className="size-4 text-sidebar-foreground transition-colors group-hover/menu-button:text-sidebar-accent-foreground group-focus-visible/menu-button:text-sidebar-accent-foreground" aria-hidden />
                  )}
                  <span className="truncate">{isSigningOut ? 'Signing out…' : 'Log out'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Need help?</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="touch-manipulation">
                  <a href={OPS_SUPPORT_ITEM.href}>
                    <SupportIcon
                      className="size-4 text-sidebar-foreground transition-colors group-hover/menu-button:text-sidebar-accent-foreground group-focus-visible/menu-button:text-sidebar-accent-foreground"
                      aria-hidden
                    />
                    <span className="truncate">{OPS_SUPPORT_ITEM.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}

export function OpsSidebarInset({ children }: { children: ReactNode }) {
  return (
    <SidebarInset id="ops-sidebar-inset" tabIndex={-1} className="bg-background">
      {children}
    </SidebarInset>
  );
}
