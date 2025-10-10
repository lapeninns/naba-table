'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, SVGProps } from 'react';
import { BarChart3, CalendarDays, CalendarPlus, CircleHelp, UsersRound } from 'lucide-react';

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

type OpsNavItem = {
  title: string;
  description?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  matcher?: (pathname: string) => boolean;
};

const NAV_ITEMS: OpsNavItem[] = [
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
  {
    title: 'Team',
    description: 'Manage staff invitations',
    href: '/ops/team',
    icon: UsersRound,
    matcher: (pathname) => pathname.startsWith('/ops/team'),
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

export function AppSidebar() {
  const pathname = usePathname();
  const SupportIcon = SUPPORT_ITEM.icon;

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
        <Link href="/ops" className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar p-2 text-sm font-semibold text-sidebar-foreground shadow-sm transition hover:border-sidebar-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-mono text-base">
            SR
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">SajiloReserveX</span>
            <span className="text-xs text-sidebar-foreground/70">Operations</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
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
                        <Icon className="size-4" aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-2" />

      <SidebarFooter className="pb-4">
        <SidebarGroup>
          <SidebarGroupLabel>Need help?</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href={SUPPORT_ITEM.href} className="touch-manipulation">
                    <SupportIcon className="size-4" aria-hidden />
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
