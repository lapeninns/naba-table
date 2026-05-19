'use client';

import { Settings2 } from 'lucide-react';

import { SidebarCollapsedRailToggle } from '@/components/features/ops-shell/patterns/SidebarCollapsedRailToggle';
import { SidebarCollapseTrigger } from '@/components/features/ops-shell/patterns/SidebarCollapseTrigger';
import { Sidebar, SidebarHeader } from '@/components/ui/sidebar';

import { RestaurantSettingsSidebarNav } from './RestaurantSettingsSidebarNav';
import { useRestaurantSettingsNav } from './useRestaurantSettingsNav';

export function RestaurantSettingsSidebar() {
  const nav = useRestaurantSettingsNav();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:hidden">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
            <p className="text-xs font-medium text-sidebar-foreground/70">Restaurant</p>
            <p className="truncate text-sm font-semibold text-sidebar-foreground">Settings</p>
          </div>
          <SidebarCollapseTrigger
            labels={{
              expanded: 'Close settings menu',
              collapsed: 'Open settings menu',
            }}
          />
        </div>
        <div className="hidden justify-center px-2 py-1 group-data-[collapsible=icon]:flex">
          <SidebarCollapsedRailToggle openLabel="Open settings menu">
            <div
              className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
              aria-hidden
            >
              <Settings2 className="size-4" />
            </div>
          </SidebarCollapsedRailToggle>
        </div>
      </SidebarHeader>
      <RestaurantSettingsSidebarNav
        normalizedPathname={nav.normalizedPathname}
        getNavBadge={nav.getNavBadge}
        prefetchSettingsView={nav.prefetchSettingsView}
        onLinkClick={nav.handleLinkClick}
      />
    </Sidebar>
  );
}
