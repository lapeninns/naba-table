'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, type MouseEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { isNavItemActive, OPS_NAV_SECTIONS } from './navigation';

import type { OpsNavigationItem } from './navigation';

/**
 * Hrefs surfaced as thumb-reachable bottom actions on phones. Everything else
 * stays one tap away behind the Menu slot (sidebar sheet). None of these are
 * admin-gated, so no permission filtering is needed here.
 */
const BOTTOM_NAV_HREFS = ['/app/dashboard', '/app/bookings', '/app/new-bookings', '/app/customers'];

const BOTTOM_NAV_SHORT_LABELS: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/bookings': 'Bookings',
  '/app/new-bookings': 'New booking',
  '/app/customers': 'Guests',
};

const itemClass =
  'flex h-full min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-none px-1 py-1.5 text-muted-foreground hover:bg-transparent hover:text-foreground';

export function OpsMobileBottomNav() {
  const pathname = usePathname();
  // App-host URLs drop the /app prefix; nav items match internal /app/* paths.
  const internalPathname = pathname ? opsHref(pathname) : null;
  const isOnline = useOnlineStatus();
  const { confirmNavigation } = useOpsUnsavedChanges();
  const { toggleSidebar, openMobile } = useSidebar();

  const items = useMemo<OpsNavigationItem[]>(() => {
    const flat = OPS_NAV_SECTIONS.flatMap((section) => section.items);
    return BOTTOM_NAV_HREFS.flatMap((href) => {
      const item = flat.find((candidate) => candidate.href === href);
      return item ? [item] : [];
    });
  }, []);

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
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = internalPathname ? isNavItemActive(internalPathname, item) : false;
          const Icon = item.icon;
          return (
            <Button
              key={item.href}
              asChild
              variant="ghost"
              className={cn(itemClass, active && 'text-primary', !isOnline && 'opacity-60')}
            >
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                aria-disabled={!isOnline}
                // Offline links are dead (onClick preventDefault); drop them from
                // the tab order so keyboard users don't land on a no-op target.
                tabIndex={!isOnline ? -1 : undefined}
                onClick={handleNavigationIntent}
              >
                <Icon aria-hidden className="size-5" />
                <span className="max-w-full truncate text-[11px] font-medium leading-tight">
                  {BOTTOM_NAV_SHORT_LABELS[item.href] ?? item.title}
                </span>
              </Link>
            </Button>
          );
        })}
        <Button
          variant="ghost"
          className={itemClass}
          onClick={toggleSidebar}
          aria-label="Open navigation menu"
          aria-expanded={openMobile}
          aria-haspopup="dialog"
        >
          <Menu aria-hidden className="size-5" />
          <span className="max-w-full truncate text-[11px] font-medium leading-tight">Menu</span>
        </Button>
      </div>
    </nav>
  );
}
