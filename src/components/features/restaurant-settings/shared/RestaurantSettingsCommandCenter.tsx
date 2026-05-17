'use client';

import { ArrowRight, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  SETTINGS_COMMAND_CENTER_LAYOUT_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_CARD_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_GRID_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
  SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
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
};

export function SettingsSectionNav({
  title = 'Workflow',
  description,
  items = [],
  footer,
  className,
}: SettingsSectionNavProps) {
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

  if (items.length === 0 && !footer) {
    return null;
  }

  return (
    <Card className={cn(SETTINGS_COMMAND_CENTER_RAIL_CARD_CLASS, className)}>
      <CardHeader className="gap-1 border-b border-border/60 px-4 py-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-xs leading-5">{description}</CardDescription>
        ) : null}
      </CardHeader>
      {items.length > 0 ? (
        <CardContent className={SETTINGS_COMMAND_CENTER_RAIL_GRID_CLASS}>
          {items.map((item, index) => {
            const Icon = item.Icon;
            const itemKey = item.href ?? item.label;
            const content = (
              <>
                {Icon ? (
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium leading-5">
                    {item.label}
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground break-words">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                {item.badge ? (
                  <Badge variant="outline" className="shrink-0">
                    {item.badge}
                  </Badge>
                ) : null}
              </>
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
                  className={cn(
                    SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
                    'h-full w-full',
                    item.isActive
                      ? SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS
                      : SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
                  )}
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
                className={cn(
                  SETTINGS_COMMAND_CENTER_RAIL_ITEM_CLASS,
                  'h-full w-full',
                  item.isActive
                    ? SETTINGS_COMMAND_CENTER_RAIL_ITEM_ACTIVE_CLASS
                    : SETTINGS_COMMAND_CENTER_RAIL_ITEM_INACTIVE_CLASS,
                )}
              >
                <Link href={item.href ?? '#'}>{content}</Link>
              </Button>
            );
          })}
        </CardContent>
      ) : null}
      {footer ? (
        <>
          <Separator />
          <div className="px-4 py-3 text-xs leading-5 text-muted-foreground">{footer}</div>
        </>
      ) : null}
    </Card>
  );
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
