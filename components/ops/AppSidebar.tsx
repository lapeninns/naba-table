'use client';

import { BarChart3, CalendarDays, CalendarPlus, CircleHelp, LogOut, Loader2, SlidersHorizontal, Store, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ComponentType, type SVGProps } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { signOutFromSupabase } from '@/lib/supabase/signOut';
import { cn } from '@/lib/utils';

import type { RestaurantRole } from '@/lib/owner/auth/roles';

type OpsNavItem = {
  title: string;
  description?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  matcher?: (pathname: string) => boolean;
};

type OpsNavSection = {
  label: string;
  items: OpsNavItem[];
};

const ROLE_LABELS: Record<RestaurantRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  host: 'Host',
  server: 'Server',
};

const NAV_SECTIONS: OpsNavSection[] = [
  {
    label: 'Daily operations',
    items: [
      {
        title: 'Dashboard',
        description: 'Today’s service overview',
        href: '/ops',
        icon: BarChart3,
        matcher: (pathname) => pathname === '/ops',
      },
      {
        title: 'Bookings',
        description: 'Manage reservations',
        href: '/ops/bookings',
        icon: CalendarDays,
        matcher: (pathname) => pathname === '/ops/bookings',
      },
      {
        title: 'Walk-in booking',
        description: 'Record guests on arrival',
        href: '/ops/bookings/new',
        icon: CalendarPlus,
        matcher: (pathname) => pathname.startsWith('/ops/bookings/new'),
      },
    ],
  },
  {
    label: 'Restaurant management',
    items: [
      {
        title: 'Team',
        description: 'Manage staff invitations',
        href: '/ops/team',
        icon: UsersRound,
        matcher: (pathname) => pathname.startsWith('/ops/team'),
      },
      {
        title: 'Manage restaurant',
        description: 'Create and manage restaurants',
        href: '/ops/manage-restaurant',
        icon: Store,
        matcher: (pathname) => pathname.startsWith('/ops/manage-restaurant'),
      },
      {
        title: 'Restaurant settings',
        description: 'Configure hours and service periods',
        href: '/ops/restaurant-settings',
        icon: SlidersHorizontal,
        matcher: (pathname) => pathname.startsWith('/ops/restaurant-settings'),
      },
    ],
  },
];

const SUPPORT_ITEM: OpsNavItem = {
  title: 'Support',
  description: 'Get help from SajiloReserveX',
  href: 'mailto:support@sajiloreservex.com',
  icon: CircleHelp,
  matcher: () => false,
};

function isActive(pathname: string, item: OpsNavItem) {
  if (item.matcher) {
    return item.matcher(pathname);
  }
  return pathname === item.href;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'SR';
  const trimmed = name.trim();
  if (!trimmed) return 'SR';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
  }
  const capitals = trimmed.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return `${capitals[0]}${capitals[1]}`;
  }
  if (trimmed.length >= 2) {
    return `${trimmed[0]}${trimmed[trimmed.length - 1]}`.toUpperCase();
  }
  return trimmed[0]?.toUpperCase() ?? 'SR';
}

export type OpsSidebarAccount = {
  restaurantName?: string | null;
  userEmail?: string | null;
  role?: RestaurantRole | null;
};

type AppSidebarProps = {
  account?: OpsSidebarAccount | null;
};

export function AppSidebar({ account }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const SupportIcon = SUPPORT_ITEM.icon;
  const [isSigningOut, setIsSigningOut] = useState(false);

  const restaurantName = account?.restaurantName?.trim() || 'SajiloReserveX';
  const roleLabel = account?.role ? ROLE_LABELS[account.role] ?? null : null;
  const email = account?.userEmail?.trim();
  const metaLine = email ? `${email}${roleLabel ? ` (${roleLabel})` : ''}` : roleLabel ?? 'Operations';

  const initials = useMemo(() => getInitials(account?.restaurantName ?? 'SajiloReserveX'), [account?.restaurantName]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      router.push('/signin');
      router.refresh();
    } catch (error) {
      console.error('[ops] Failed to sign out', error);
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, router]);

  if (!pathname) {
    return (
      <Sidebar collapsible="icon">
        <SidebarContent className="px-2 py-3">
          <SidebarMenu>
            {Array.from({ length: 3 }).map((_, index) => (
              <SidebarMenuItem key={index}>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 pt-4">
        <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-sm">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">{restaurantName}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{metaLine}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(pathname, item);
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
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  aria-busy={isSigningOut}
                  className="touch-manipulation"
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
                <SidebarMenuButton asChild>
                  <a href={SUPPORT_ITEM.href} className="touch-manipulation">
                    <SupportIcon
                      className="size-4 text-sidebar-foreground transition-colors group-hover/menu-button:text-sidebar-accent-foreground group-focus-visible/menu-button:text-sidebar-accent-foreground"
                      aria-hidden
                    />
                    <span className="truncate">{SUPPORT_ITEM.title}</span>
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
