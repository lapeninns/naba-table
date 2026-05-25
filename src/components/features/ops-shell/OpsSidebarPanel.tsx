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

import { filterOpsNavigationSections } from './navigation';
import { OpsRestaurantSwitch } from './OpsRestaurantSwitch';
import { OpsSidebarFooter } from './OpsSidebarFooter';
import { OpsSidebarNav } from './OpsSidebarNav';
import { SidebarCollapsedRailToggle } from './patterns/SidebarCollapsedRailToggle';
import { SidebarCollapseTrigger } from './patterns/SidebarCollapseTrigger';

import type { OpsNavigationSection } from './navigation';

export function OpsSidebarPanel() {
  const pathname = usePathname();
  const { featureFlags, permissions } = useOpsSession();

  const sections = useMemo<OpsNavigationSection[]>(() => {
    return filterOpsNavigationSections({
      featureFlags,
      canViewAdminItems: permissions.canManageSettings,
    });
  }, [featureFlags, permissions.canManageSettings]);

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
        {!pathname ? (
          <OpsSidebarSkeleton />
        ) : (
          <OpsSidebarNav sections={sections} pathname={pathname} />
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
