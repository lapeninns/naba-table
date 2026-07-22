'use client';

import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarRail } from '@/components/ui/sidebar';
import { Text } from '@/components/ui/typography';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { cn } from '@/lib/utils';

import { RestaurantSettingsChromeHeader } from './RestaurantSettingsChromeHeader';
import { RestaurantSettingsSectionNavSlotContext } from './RestaurantSettingsSectionNavSlot';
import { RestaurantSettingsSidebar } from './RestaurantSettingsSidebar';
import { SETTINGS_COMPACT_PAGE_CONTENT_CLASS } from './shared';

export type RestaurantSettingsFocusedShellProps = {
  children: ReactNode;
  envBanner?: string | null;
};

export function RestaurantSettingsFocusedShell({
  children,
  envBanner,
}: RestaurantSettingsFocusedShellProps) {
  const { confirmNavigation } = useOpsUnsavedChanges();
  const [sectionNav, setSectionNav] = useState<ReactNode | null>(null);

  const sectionNavSlot = useMemo(
    () => ({
      setSectionNav,
      hasDockedSectionNav: sectionNav != null,
    }),
    [sectionNav],
  );

  const handleExitClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  const handleBreadcrumbParentClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  return (
    <SidebarProvider className="flex h-svh min-h-0 w-full overflow-hidden bg-background">
      <RestaurantSettingsSidebar />
      <SidebarRail />
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <Button
          asChild
          variant="link"
          className="sr-only h-auto p-0 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-40 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow"
        >
          <a href="#ops-content">Skip to content</a>
        </Button>
        <RestaurantSettingsSectionNavSlotContext.Provider value={sectionNavSlot}>
          <RestaurantSettingsChromeHeader
            onBreadcrumbParentClick={handleBreadcrumbParentClick}
            onExitClick={handleExitClick}
          />
          {sectionNav}

          {envBanner ? (
            <Text
              variant="caption"
              className="shrink-0 border-b border-border/60 bg-muted/40 px-4 py-2 text-center sm:px-6"
              role="status"
            >
              {envBanner}
            </Text>
          ) : null}

          <div
            id="ops-content"
            tabIndex={-1}
            className={cn(
              'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto',
              sectionNavSlot.hasDockedSectionNav
                ? 'px-4 pb-6 pt-4 sm:px-8 lg:pb-8'
                : 'px-4 py-6 sm:px-8 lg:py-8',
              SETTINGS_COMPACT_PAGE_CONTENT_CLASS,
            )}
          >
            {children}
          </div>
        </RestaurantSettingsSectionNavSlotContext.Provider>
      </SidebarInset>
    </SidebarProvider>
  );
}
