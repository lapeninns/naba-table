'use client';

import { Info } from 'lucide-react';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';

import { OPS_SHELL_GUTTER_X_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider, SidebarRail } from '@/components/ui/sidebar';
import { Text } from '@/components/ui/typography';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { cn } from '@/lib/utils';

import { RestaurantSettingsChromeHeader } from './RestaurantSettingsChromeHeader';
import {
  createRestaurantSettingsSaveBarStore,
  RestaurantSettingsSaveBarOutlet,
  RestaurantSettingsSaveBarSlotContext,
} from './RestaurantSettingsSaveBarSlot';
import { RestaurantSettingsSectionNavSlotContext } from './RestaurantSettingsSectionNavSlot';
import { RestaurantSettingsSidebar } from './RestaurantSettingsSidebar';
import { SETTINGS_COMPACT_PAGE_CONTENT_CLASS } from './shared';

export type RestaurantSettingsFocusedShellProps = {
  children: ReactNode;
  envBanner?: string | null;
  /** Explicit chrome title for routes without settings route copy (legacy pages, harnesses). */
  title?: string;
  /** Full-height workspace: content fills the area edge to edge and scrolls its own panes. */
  workspace?: boolean;
};

export function RestaurantSettingsFocusedShell({
  children,
  envBanner,
  title,
  workspace = false,
}: RestaurantSettingsFocusedShellProps) {
  const { confirmNavigation } = useOpsUnsavedChanges();
  const [sectionNav, setSectionNav] = useState<ReactNode | null>(null);
  // An external store, not state: the page pushes its bar on every keystroke and only the
  // outlet below re-renders.
  const [saveBarSlot] = useState(createRestaurantSettingsSaveBarStore);

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
          <RestaurantSettingsSaveBarSlotContext.Provider value={saveBarSlot}>
            {/* Environment notices frame the whole workspace, so they sit above the chrome
              rather than between the section tabs and the content they control. */}
            {envBanner ? (
              <Text
                variant="caption"
                className={cn(
                  'flex shrink-0 items-start gap-2 border-b border-border/60 bg-muted/40 py-1.5 sm:items-center',
                  OPS_SHELL_GUTTER_X_CLASS,
                )}
                role="status"
              >
                <Info className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
                <span className="min-w-0">{envBanner}</span>
              </Text>
            ) : null}

            <RestaurantSettingsChromeHeader
              onBreadcrumbParentClick={handleBreadcrumbParentClick}
              onExitClick={handleExitClick}
              title={title}
            />
            {sectionNav}

            {/* The only scroll container: chrome and docked tabs never overlap content. Scroll
              padding keeps keyboard focus clear of sticky rails and bottom save bars. */}
            <div
              id="ops-content"
              tabIndex={-1}
              data-layout={workspace ? 'workspace' : 'page'}
              className={
                workspace
                  ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                  : cn(
                      'min-h-0 min-w-0 flex-1 scroll-pb-28 scroll-pt-14 overflow-x-hidden overflow-y-auto overscroll-contain',
                      'pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:pb-8',
                      sectionNavSlot.hasDockedSectionNav ? 'pt-4' : 'pt-4 sm:pt-6',
                      OPS_SHELL_GUTTER_X_CLASS,
                      SETTINGS_COMPACT_PAGE_CONTENT_CLASS,
                    )
              }
            >
              {children}
            </div>
            <RestaurantSettingsSaveBarOutlet store={saveBarSlot} />
          </RestaurantSettingsSaveBarSlotContext.Provider>
        </RestaurantSettingsSectionNavSlotContext.Provider>
      </SidebarInset>
    </SidebarProvider>
  );
}
