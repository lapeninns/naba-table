'use client';

import {
  CalendarClock,
  ClipboardCheck,
  Compass,
  BellRing,
  LayoutGrid,
  Mail,
  MapPinned,
  PencilRuler,
  Store,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, type MouseEvent } from 'react';

import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

import {
  getRestaurantSettingsNavUnsavedEntryId,
  GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS,
  isRestaurantSettingsNavItemActive,
  type SettingsHref,
} from './useRestaurantSettingsNav';

const NAV_ICONS: Record<SettingsHref, LucideIcon> = {
  '/app/settings/restaurant': ClipboardCheck,
  '/app/settings/restaurant/profile': Store,
  '/app/settings/restaurant/discovery': Compass,
  '/app/settings/restaurant/google-business-profile': MapPinned,
  '/app/settings/restaurant/availability': CalendarClock,
  '/app/settings/restaurant/menu': UtensilsCrossed,
  '/app/settings/restaurant/tables': LayoutGrid,
  '/app/settings/restaurant/team': Users,
  '/app/settings/restaurant/staff-communications': BellRing,
  '/app/settings/restaurant/table-layout': PencilRuler,
  '/app/settings/restaurant/email-templates': Mail,
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
  // Href of a link that just received pointerdown: the focus that follows a mouse
  // click must not prefetch again (hover already did). Keyboard focus still does.
  const pointerFocusHrefRef = useRef<SettingsHref | null>(null);

  return (
    <SidebarContent role="navigation" aria-label="Restaurant settings" className="gap-0">
      {GROUPED_RESTAURANT_SETTINGS_NAV_ITEMS.map((group) => (
        <SidebarGroup key={group.label ?? 'overview'}>
          {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const href = item.href as SettingsHref;
                const active =
                  normalizedPathname != null
                    ? isRestaurantSettingsNavItemActive(normalizedPathname, item)
                    : false;
                const Icon = NAV_ICONS[href] ?? LayoutGrid;
                const badge = getNavBadge(href);
                const unsavedEntryId = getRestaurantSettingsNavUnsavedEntryId(href);
                const hasUnsaved =
                  unsavedEntryId != null && entries.some((entry) => entry.id === unsavedEntryId);

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        onMouseEnter={() => prefetchSettingsView(href)}
                        onPointerDown={() => {
                          pointerFocusHrefRef.current = href;
                        }}
                        onPointerCancel={() => {
                          pointerFocusHrefRef.current = null;
                        }}
                        onFocus={() => {
                          const fromPointer = pointerFocusHrefRef.current === href;
                          pointerFocusHrefRef.current = null;
                          if (!fromPointer) prefetchSettingsView(href);
                        }}
                        onClick={(event) => {
                          pointerFocusHrefRef.current = null;
                          onLinkClick(event);
                        }}
                        className={cn(badge && 'pr-20')}
                      >
                        <Icon aria-hidden />
                        <span className="min-w-0 truncate">{item.title}</span>
                        {hasUnsaved ? (
                          <Badge
                            variant="status-pending"
                            className="ml-auto shrink-0 px-1.5 py-0 leading-4 group-data-[collapsible=icon]:hidden"
                          >
                            Unsaved
                          </Badge>
                        ) : null}
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
