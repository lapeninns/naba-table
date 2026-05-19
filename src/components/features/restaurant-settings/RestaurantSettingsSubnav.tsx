'use client';

/**
 * Standalone settings sidebar for harness/tests. Production routes use
 * {@link RestaurantSettingsFocusedShell} with {@link RestaurantSettingsSidebar}.
 */
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

import { RestaurantSettingsSidebarNav } from './RestaurantSettingsSidebarNav';
import { SETTINGS_COMPACT_STATUS_ROW_CLASS } from './shared';
import { useRestaurantSettingsNav } from './useRestaurantSettingsNav';

export function RestaurantSettingsSubnav() {
  const nav = useRestaurantSettingsNav();

  return (
    <SidebarProvider className="min-h-0 w-full bg-background">
      <Sidebar collapsible="icon" className="h-auto min-h-0">
        <RestaurantSettingsSidebarNav
          normalizedPathname={nav.normalizedPathname}
          getNavBadge={nav.getNavBadge}
          prefetchSettingsView={nav.prefetchSettingsView}
          onLinkClick={nav.handleLinkClick}
        />
      </Sidebar>
      <p className={cn(SETTINGS_COMPACT_STATUS_ROW_CLASS, 'sr-only')}>
        Six restaurant settings sections are available in this compact navigation.
      </p>
    </SidebarProvider>
  );
}
