'use client';

import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
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
  SETTINGS_COMMAND_CENTER_RAIL_FADE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS,
} from './compactSettingsClasses';
import { announceSettingsSectionJump } from './useSettingsSectionSpy';

/** Section status on a jump link: "Edited" or "N issues". Always text, never colour alone. */
export type SettingsSectionNavBadge = {
  label: string;
  tone: 'edited' | 'issue';
  /** Screen-reader wording when the visible label is terse, e.g. "3 issues". */
  srLabel?: string;
};

export type RestaurantSettingsCommandRailItem = {
  label: string;
  description?: string;
  href?: string;
  /** In-page section id: renders an anchor that scrolls there without moving focus. */
  targetId?: string;
  isActive?: boolean;
  onSelect?: () => void;
  badge?: string | SettingsSectionNavBadge | null;
  Icon?: LucideIcon;
  /** Step is not available yet; rendered but not actionable (the description says why). */
  disabled?: boolean;
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Scrolls a page section into view inside the settings scroll area, without moving focus. */
export function scrollToSettingsSection(targetId: string) {
  const target = typeof document !== 'undefined' ? document.getElementById(targetId) : null;
  if (!target) {
    return;
  }
  target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  announceSettingsSectionJump(targetId);
  if (typeof window !== 'undefined' && window.location.hash !== `#${targetId}`) {
    window.history.replaceState(window.history.state, '', `#${targetId}`);
  }
}

function SectionNavBadge({ badge }: { badge: string | SettingsSectionNavBadge }) {
  if (typeof badge === 'string') {
    return (
      <Badge variant="outline" className="h-5 shrink-0 px-1.5">
        {badge}
      </Badge>
    );
  }
  return (
    <Badge
      variant={badge.tone === 'issue' ? 'status-cancelled' : 'status-pending'}
      className="h-5 shrink-0 gap-1 px-1.5"
    >
      {badge.tone === 'issue' ? <AlertTriangle className="size-3" aria-hidden /> : null}
      <span aria-hidden={badge.srLabel ? true : undefined}>{badge.label}</span>
      {badge.srLabel ? <span className="sr-only">{badge.srLabel}</span> : null}
    </Badge>
  );
}

export function sectionNavOverflowEdges(metrics: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): { start: boolean; end: boolean } {
  const { scrollLeft, clientWidth, scrollWidth } = metrics;
  if (scrollWidth <= clientWidth + 1) {
    return { start: false, end: false };
  }
  return {
    start: scrollLeft > 1,
    end: scrollLeft + clientWidth < scrollWidth - 1,
  };
}

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
  const listRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const updateOverflow = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    setOverflow(
      sectionNavOverflowEdges({
        scrollLeft: list.scrollLeft,
        clientWidth: list.clientWidth,
        scrollWidth: list.scrollWidth,
      }),
    );
  }, []);
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
          {item.badge ? <SectionNavBadge badge={item.badge} /> : null}
        </>
      );
      const itemClassName = cn(
        SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
        item.isActive
          ? SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS
          : SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
      );

      if (item.targetId) {
        const targetId = item.targetId;
        return (
          <Button
            key={itemKey}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            asChild
            variant="ghost"
            aria-current={item.isActive ? 'location' : undefined}
            onKeyDown={(event) => handleRailItemKeyDown(event, index)}
            className={itemClassName}
          >
            <a
              href={`#${targetId}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToSettingsSection(targetId);
                item.onSelect?.();
              }}
            >
              {content}
            </a>
          </Button>
        );
      }

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
            disabled={item.disabled}
            title={item.disabled ? item.description : undefined}
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
    .map((item) => {
      const badge =
        typeof item.badge === 'string'
          ? item.badge
          : item.badge
            ? `${item.badge.tone}:${item.badge.label}`
            : '';
      return `${item.label}:${item.isActive ? '1' : '0'}:${badge}`;
    })
    .join('|');

  // On phones the rail scrolls sideways; keep the current tab in view without moving the page
  // (scrollIntoView would also scroll the settings content vertically).
  // Keyed on the items signature so a new active tab yields a new ref callback, which React
  // re-invokes with the mounted list.
  const revealActiveItem = useCallback(
    (list: HTMLDivElement | null) => {
      listRef.current = list;
      const active = itemsSignature
        ? list?.querySelector<HTMLElement>('[aria-current="page"], [aria-current="location"]')
        : null;
      if (!list || !active) {
        updateOverflow();
        return;
      }
      const overflowLeft = active.offsetLeft - list.scrollLeft;
      const overflowRight = overflowLeft + active.offsetWidth - list.clientWidth;
      if (overflowLeft < 0) {
        list.scrollLeft = active.offsetLeft - 16;
      } else if (overflowRight > 0) {
        list.scrollLeft += overflowRight + 16;
      }
      updateOverflow();
    },
    [itemsSignature, updateOverflow],
  );

  const nav = useMemo(
    () => (
      <nav aria-label={title} className={navClassName}>
        {showHeader ? (
          <motion.div
            className="flex flex-col gap-1 border-b border-border/60 px-[var(--ops-shell-gutter)] py-2.5"
            initial={false}
          >
            <Text variant="label">{title}</Text>
            {description ? <Text variant="caption">{description}</Text> : null}
          </motion.div>
        ) : (
          <span className="sr-only">{title}</span>
        )}
        {items.length > 0 ? (
          <div className="relative min-w-0">
            <div
              ref={revealActiveItem}
              className={SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS}
              role="list"
              onScroll={updateOverflow}
            >
              {items.map((item, index) => (
                <div key={item.href ?? item.label} role="listitem">
                  {renderNavItem(item, index)}
                </div>
              ))}
            </div>
            {overflow.start ? (
              <div
                aria-hidden
                className={cn(
                  SETTINGS_COMMAND_CENTER_RAIL_FADE_CLASS,
                  'left-0 border-r border-border/60',
                )}
              />
            ) : null}
            {overflow.end ? (
              <div
                aria-hidden
                className={cn(
                  SETTINGS_COMMAND_CENTER_RAIL_FADE_CLASS,
                  'right-0 border-l border-border/60',
                )}
              />
            ) : null}
          </div>
        ) : null}
        {footer ? (
          <Text
            variant="caption"
            className="border-t border-border/60 px-[var(--ops-shell-gutter)] py-1.5"
          >
            {footer}
          </Text>
        ) : null}
      </nav>
    ),
    [
      description,
      footer,
      items,
      navClassName,
      overflow.end,
      overflow.start,
      renderNavItem,
      revealActiveItem,
      showHeader,
      title,
      updateOverflow,
    ],
  );

  useLayoutEffect(() => {
    updateOverflow();
    window.addEventListener('resize', updateOverflow);
    return () => window.removeEventListener('resize', updateOverflow);
  }, [itemsSignature, updateOverflow]);

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
