'use client';

import { Settings2 } from 'lucide-react';

import { SidebarCollapsedRailToggle } from '@/components/features/ops-shell/patterns/SidebarCollapsedRailToggle';
import { SidebarCollapseTrigger } from '@/components/features/ops-shell/patterns/SidebarCollapseTrigger';
import { Sidebar, SidebarHeader } from '@/components/ui/sidebar';

import { RestaurantSettingsSidebarNav } from './RestaurantSettingsSidebarNav';
import { useRestaurantSettingsContext } from './shell/useRestaurantSettingsContext';
import { useRestaurantSettingsNav } from './useRestaurantSettingsNav';

export function RestaurantSettingsSidebar() {
  const nav = useRestaurantSettingsNav();
  const { restaurantName } = useRestaurantSettingsContext();

  return (
    <Sidebar collapsible="icon">
      {/* One 48px row so its bottom border continues the settings chrome's border. */}
      <SidebarHeader className="h-[var(--ops-chrome-height)] justify-center border-b border-sidebar-border py-0">
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:hidden">
          {/* Names the tenant being edited; the chrome shows it only when this rail is collapsed. */}
          <p
            className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground"
            title={restaurantName ?? undefined}
          >
            <span className="sr-only">Settings for </span>
            {restaurantName ?? 'Restaurant'}
          </p>
          <SidebarCollapseTrigger
            labels={{
              expanded: 'Close settings menu',
              collapsed: 'Open settings menu',
            }}
          />
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
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
