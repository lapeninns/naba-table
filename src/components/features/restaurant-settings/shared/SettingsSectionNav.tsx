'use client';

import { type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { useRestaurantSettingsSectionNavSlot } from '../RestaurantSettingsSectionNavSlot';
import {
  SETTINGS_COMMAND_CENTER_DOCKED_NAV_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS,
} from './compactSettingsClasses';

export type RestaurantSettingsCommandRailItem = {
  label: string;
  description?: string;
  href?: string;
  isActive?: boolean;
  onSelect?: () => void;
  badge?: string;
  Icon?: LucideIcon;
};

export type SettingsSectionNavProps = {
  title?: string;
  description?: string;
  items?: RestaurantSettingsCommandRailItem[];
  footer?: ReactNode;
  className?: string;
  /** When false, only `title` is exposed to assistive tech (page heading covers the section). */
  showHeader?: boolean;
  /** Pin the nav to the top of the scrolling settings main pane. */
  sticky?: boolean;
  /** When `chrome`, render tabs directly under the settings header (default in focused shell). */
  dock?: 'chrome' | 'inline';
};

export function SettingsSectionNav({
  title = 'Workflow',
  description,
  items = [],
  footer,
  className,
  showHeader = Boolean(description),
  sticky = true,
  dock = 'chrome',
}: SettingsSectionNavProps) {
  const sectionNavSlot = useRestaurantSettingsSectionNavSlot();
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const focusRailItem = useCallback(
    (nextIndex: number) => {
      const count = items.length;
      if (count === 0) {
        return;
      }
      const normalizedIndex = (nextIndex + count) % count;
      itemRefs.current[normalizedIndex]?.focus();
    },
    [items.length],
  );
  const handleRailItemKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, index: number) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault();
          focusRailItem(index + 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault();
          focusRailItem(index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusRailItem(0);
          break;
        case 'End':
          event.preventDefault();
          focusRailItem(items.length - 1);
          break;
        default:
          break;
      }
    },
    [focusRailItem, items.length],
  );

  const renderNavItem = useCallback(
    (item: RestaurantSettingsCommandRailItem, index: number) => {
      const Icon = item.Icon;
      const itemKey = item.href ?? item.label;
      const content = (
        <>
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
          <span>{item.label}</span>
          {item.badge ? (
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">
              {item.badge}
            </Badge>
          ) : null}
        </>
      );
      const itemClassName = cn(
        SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
        item.isActive
          ? SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS
          : SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
      );

      if (item.onSelect) {
        return (
          <Button
            key={itemKey}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            variant="ghost"
            aria-current={item.isActive ? 'page' : undefined}
            onClick={item.onSelect}
            onKeyDown={(event) => handleRailItemKeyDown(event, index)}
            className={itemClassName}
          >
            {content}
          </Button>
        );
      }

      return (
        <Button
          key={itemKey}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          asChild
          variant="ghost"
          aria-current={item.isActive ? 'page' : undefined}
          onKeyDown={(event) => handleRailItemKeyDown(event, index)}
          className={itemClassName}
        >
          <Link href={item.href ?? '#'}>{content}</Link>
        </Button>
      );
    },
    [handleRailItemKeyDown],
  );

  const shouldDockInChrome = dock === 'chrome' && sectionNavSlot != null;
  const navClassName = cn(
    shouldDockInChrome
      ? SETTINGS_COMMAND_CENTER_DOCKED_NAV_CLASS
      : sticky
        ? SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS
        : 'mb-4 border-b border-border/60',
    className,
  );

  const itemsSignature = items
    .map((item) => `${item.label}:${item.isActive ? '1' : '0'}:${item.badge ?? ''}`)
    .join('|');

  const nav = useMemo(
    () => (
      <nav aria-label={title} className={navClassName}>
        {showHeader ? (
          <motion.div
            className="flex flex-col gap-1 border-b border-border/60 px-4 py-2.5 sm:px-6"
            initial={false}
          >
            <Text variant="label">{title}</Text>
            {description ? (
              <Text variant="caption">{description}</Text>
            ) : null}
          </motion.div>
        ) : (
          <span className="sr-only">{title}</span>
        )}
        {items.length > 0 ? (
          <div className={SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS} role="list">
            {items.map((item, index) => (
              <motion.div key={item.href ?? item.label} role="listitem">
                {renderNavItem(item, index)}
              </motion.div>
            ))}
          </div>
        ) : null}
        {footer ? (
          <Text variant="caption" className="border-t border-border/60 px-4 py-1.5 sm:px-6">
            {footer}
          </Text>
        ) : null}
      </nav>
    ),
    [description, footer, items, navClassName, renderNavItem, showHeader, title],
  );

  useLayoutEffect(() => {
    if (!shouldDockInChrome || !sectionNavSlot) {
      return;
    }

    if (items.length === 0 && !footer) {
      sectionNavSlot.setSectionNav(null);
      return;
    }

    sectionNavSlot.setSectionNav(nav);
    return () => sectionNavSlot.setSectionNav(null);
  }, [footer, items.length, itemsSignature, nav, sectionNavSlot, shouldDockInChrome]);

  if (items.length === 0 && !footer) {
    return null;
  }

  if (shouldDockInChrome) {
    return null;
  }

  return nav;
}
