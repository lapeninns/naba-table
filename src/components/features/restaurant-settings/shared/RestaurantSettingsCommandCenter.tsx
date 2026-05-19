'use client';

import { type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { SETTINGS_COMMAND_CENTER_LAYOUT_CLASS } from './compactSettingsClasses';
import { SettingsSectionNav, type RestaurantSettingsCommandRailItem } from './SettingsSectionNav';

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
