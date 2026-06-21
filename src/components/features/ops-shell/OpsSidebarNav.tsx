'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, type MouseEvent } from 'react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

import { isNavItemActive } from './navigation';
import { useOpsRoutePrefetch } from './useOpsRoutePrefetch';

import type { OpsNavigationSection } from './navigation';

const OPS_SIDEBAR_PREFETCH_DELAY_MS = 200;

export type OpsSidebarNavProps = {
  sections: OpsNavigationSection[];
  pathname: string;
};

export function OpsSidebarNav({ sections, pathname }: OpsSidebarNavProps) {
  const isOnline = useOnlineStatus();
  const { confirmNavigation } = useOpsUnsavedChanges();
  const prefetchRoute = useOpsRoutePrefetch();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };
  }, []);

  const schedulePrefetch = useCallback(
    (href: string) => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
      prefetchTimerRef.current = setTimeout(() => {
        prefetchTimerRef.current = null;
        prefetchRoute(href);
      }, OPS_SIDEBAR_PREFETCH_DELAY_MS);
    },
    [prefetchRoute],
  );

  const handleNavigationIntent = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isOnline) {
        event.preventDefault();
        return;
      }

      if (!confirmNavigation()) {
        event.preventDefault();
      }
    },
    [confirmNavigation, isOnline],
  );

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <SidebarGroup key={section.label ?? `section-${sectionIndex}`}>
          {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {section.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={cn(!isOnline && 'opacity-60')}
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        aria-disabled={!isOnline}
                        onMouseEnter={() => schedulePrefetch(item.href)}
                        onFocus={() => schedulePrefetch(item.href)}
                        onClick={handleNavigationIntent}
                      >
                        <Icon aria-hidden />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
