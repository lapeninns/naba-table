'use client';

import {
  CalendarClock,
  Compass,
  LayoutGrid,
  MapPinned,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
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
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';

import {
  GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS,
  isRestaurantSettingsNavItemActive,
  type SettingsHref,
} from './useRestaurantSettingsNav';

import type { MouseEvent } from 'react';

const NAV_ICONS: Record<SettingsHref, LucideIcon> = {
  '/app/settings/restaurant/profile': Store,
  '/app/settings/restaurant/discovery': Compass,
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
  const { entries } = useOpsUnsavedChanges();

  return (
    <SidebarContent role="navigation" aria-label="Restaurant settings" className="gap-0">
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

                const hasUnsaved =
                  (item.href === '/app/settings/restaurant/profile' &&
                    entries.some((e) => e.id === 'restaurant-profile')) ||
                  (item.href === '/app/settings/restaurant/discovery' &&
                    entries.some((e) => e.id === 'restaurant-discovery')) ||
                  (item.href === '/app/settings/restaurant/availability' &&
                    entries.some(
                      (e) =>
                        e.id === 'restaurant-booking-rules' ||
                        e.id === 'availability-command-center' ||
                        e.id === 'weekly-operating-hours' ||
                        e.id === 'service-windows' ||
                        e.id === 'date-overrides' ||
                        e.id === 'booking-occasions-turnbands',
                    ));

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
                        {hasUnsaved && (
                          <span
                            className="ml-1.5 size-1.5 shrink-0 animate-pulse rounded-full bg-primary"
                            aria-label="Unsaved changes alert"
                            title="Unsaved changes in this tab"
                          />
                        )}
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
