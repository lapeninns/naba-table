'use client';

import { CalendarClock, LayoutGrid, MapPinned, Store, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

import {
  GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS,
  isRestaurantSettingsNavItemActive,
  type SettingsHref,
} from './useRestaurantSettingsNav';

import type { MouseEvent } from 'react';

const NAV_ICONS: Record<SettingsHref, LucideIcon> = {
  '/app/settings/restaurant/profile': Store,
  '/app/settings/restaurant/google-business-profile': MapPinned,
  '/app/settings/restaurant/availability': CalendarClock,
  '/app/settings/restaurant/menu': LayoutGrid,
  '/app/settings/restaurant/tables': LayoutGrid,
  '/app/settings/restaurant/team': Users,
};

export type RestaurantSettingsSidebarNavProps = {
  normalizedPathname: string | null;
  getNavBadge: (href: SettingsHref) => string | undefined;
  prefetchSettingsView: (href: SettingsHref) => void;
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function RestaurantSettingsSidebarNav({
  normalizedPathname,
  getNavBadge,
  prefetchSettingsView,
  onLinkClick,
}: RestaurantSettingsSidebarNavProps) {
  return (
    <SidebarContent
      role="navigation"
      aria-label="Restaurant settings"
      className="gap-0"
    >
      {GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active =
                  normalizedPathname != null
                    ? isRestaurantSettingsNavItemActive(normalizedPathname, item)
                    : false;
                const Icon = NAV_ICONS[item.href] ?? LayoutGrid;
                const badge = getNavBadge(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onMouseEnter={() => prefetchSettingsView(item.href)}
                        onFocus={() => prefetchSettingsView(item.href)}
                        onClick={onLinkClick}
                      >
                        <Icon aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}
