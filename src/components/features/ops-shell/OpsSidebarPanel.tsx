'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterSlot,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { useOpsSession } from '@/contexts/ops-session';
import { opsHref } from '@/lib/url/opsHref';

import { filterOpsNavigationSections } from './navigation';
import { OpsRestaurantSwitch } from './OpsRestaurantSwitch';
import { OpsSidebarFooter } from './OpsSidebarFooter';
import { OpsSidebarNav } from './OpsSidebarNav';
import { SidebarCollapsedRailToggle } from './patterns/SidebarCollapsedRailToggle';
import { SidebarCollapseTrigger } from './patterns/SidebarCollapseTrigger';

import type { OpsNavigationSection } from './navigation';

export function OpsSidebarPanel() {
  const pathname = usePathname();
  // App-host URLs drop the /app prefix; nav items match internal /app/* paths.
  const internalPathname = pathname ? opsHref(pathname) : null;
  const { permissions } = useOpsSession();

  const sections = useMemo<OpsNavigationSection[]>(() => {
    return filterOpsNavigationSections({
      canViewAdminItems: permissions.canManageSettings,
    });
  }, [permissions.canManageSettings]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <OpsRestaurantSwitch className="min-w-0 flex-1" />
          <SidebarCollapseTrigger />
        </div>
        <div className="hidden justify-center px-2 py-1 group-data-[collapsible=icon]:flex">
          <SidebarCollapsedRailToggle openLabel="Open sidebar">
            <OpsRestaurantSwitch className="[&_[data-sidebar=menu-button]]:size-8 [&_[data-sidebar=menu-button]]:p-0" />
          </SidebarCollapsedRailToggle>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {!internalPathname ? (
          <OpsSidebarSkeleton />
        ) : (
          <OpsSidebarNav sections={sections} pathname={internalPathname} />
        )}
      </SidebarContent>
      <SidebarFooterSlot>
        <OpsSidebarFooter />
      </SidebarFooterSlot>
    </Sidebar>
  );
}

function OpsSidebarSkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Loading</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {Array.from({ length: 5 }).map((_, index) => (
            <SidebarMenuItem key={`ops-sidebar-skeleton-${index}`}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
