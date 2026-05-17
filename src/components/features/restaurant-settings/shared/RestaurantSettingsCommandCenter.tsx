'use client';

import { type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { useRestaurantSettingsSectionNavSlot } from '../RestaurantSettingsSectionNavSlot';

import {
  SETTINGS_COMMAND_CENTER_DOCKED_NAV_CLASS,
  SETTINGS_COMMAND_CENTER_LAYOUT_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_LIST_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_NAV_CLASS,
} from './compactSettingsClasses';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) {
      return;
    }
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

export type RestaurantSettingsCommandMetric = {
  label: string;
  value: ReactNode;
  description?: string;
  variant?: BadgeVariant;
  Icon?: LucideIcon;
};

export type RestaurantSettingsCommandRailItem = {
  label: string;
  description?: string;
  href?: string;
  isActive?: boolean;
  onSelect?: () => void;
  badge?: string;
  Icon?: LucideIcon;
};

type RestaurantSettingsCommandCenterProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: RestaurantSettingsCommandMetric[];
  showHeader?: boolean;
  showMetrics?: boolean;
  primaryAction?: ReactNode;
  railTitle?: string;
  railDescription?: string;
  railItems?: RestaurantSettingsCommandRailItem[];
  railClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
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

  const renderNavItem = (item: RestaurantSettingsCommandRailItem, index: number) => {
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
  };

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
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? (
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
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
        <p className="border-t border-border/60 px-4 py-1.5 text-xs leading-5 text-muted-foreground sm:px-6">
          {footer}
        </p>
      ) : null}
    </nav>
    ),
    [description, footer, items, itemsSignature, navClassName, showHeader, title],
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
  }, [footer, items.length, itemsSignature, nav, sectionNavSlot, shouldDockInChrome, title]);

  if (items.length === 0 && !footer) {
    return null;
  }

  if (shouldDockInChrome) {
    return null;
  }

  return nav;
}

export function RestaurantSettingsCommandCenter({
  eyebrow,
  title,
  description,
  metrics = [],
  showHeader = true,
  showMetrics = true,
  primaryAction,
  railTitle = 'Workflow',
  railDescription,
  railItems = [],
  railClassName,
  children,
  footer,
  className,
}: RestaurantSettingsCommandCenterProps) {
  const reduceMotion = usePrefersReducedMotion();
  const visibleMetrics = showMetrics ? metrics : [];

  return (
    <motion.section
      className={cn(SETTINGS_COMMAND_CENTER_LAYOUT_CLASS, className)}
      initial={reduceMotion ? false : { y: 10, opacity: 0 }}
      animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {showHeader ? (
        <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
          <CardHeader className="gap-4 border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <Badge variant="outline" className="w-fit">
                {eyebrow}
              </Badge>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-2xl leading-tight tracking-tight text-foreground">
                  {title}
                </CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  {description}
                </CardDescription>
              </div>
            </div>
            {primaryAction ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{primaryAction}</div>
            ) : null}
          </CardHeader>

          {visibleMetrics.length > 0 ? (
            <CardContent className="bg-card px-4 py-3 sm:px-5">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleMetrics.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <div
                      key={item.label}
                      className="min-w-0 rounded-lg border border-border/60 bg-background p-3 shadow-none"
                    >
                      <dt className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
                        {item.label}
                      </dt>
                      <dd className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant={item.variant ?? 'secondary'} className="max-w-full">
                          {item.value}
                        </Badge>
                        {item.description ? (
                          <span className="min-w-0 text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <SettingsSectionNav
        title={railTitle}
        description={railDescription}
        items={railItems}
        footer={footer}
        className={railClassName}
      />

      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </motion.section>
  );
}
