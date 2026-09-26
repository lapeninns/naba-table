'use client';

import { type LucideIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import {
  SETTINGS_COMMAND_CENTER_LAYOUT_CLASS,
  SETTINGS_ENTER_FADE_CLASS,
} from './compactSettingsClasses';
import { SettingsSectionNav, type RestaurantSettingsCommandRailItem } from './SettingsSectionNav';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

export type RestaurantSettingsCommandMetric = {
  label: string;
  value: ReactNode;
  description?: string;
  variant?: BadgeVariant;
  Icon?: LucideIcon;
};

type RestaurantSettingsCommandCenterProps = {
  /** @deprecated No longer rendered: the settings chrome already names the section. */
  eyebrow?: string;
  title: string;
  description: string;
  metrics?: RestaurantSettingsCommandMetric[];
  showHeader?: boolean;
  showMetrics?: boolean;
  primaryAction?: ReactNode;
  /** Page save status or facts, shown under the purpose line (`SettingsStatusLine`). */
  status?: ReactNode;
  railTitle?: string;
  railDescription?: string;
  railItems?: RestaurantSettingsCommandRailItem[];
  railClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function RestaurantSettingsCommandCenter({
  title,
  description,
  metrics = [],
  showHeader = true,
  showMetrics = true,
  primaryAction,
  status,
  railTitle = 'Workflow',
  railDescription,
  railItems = [],
  railClassName,
  children,
  footer,
  className,
}: RestaurantSettingsCommandCenterProps) {
  const visibleMetrics = showMetrics ? metrics : [];

  return (
    <section
      className={cn(SETTINGS_COMMAND_CENTER_LAYOUT_CLASS, SETTINGS_ENTER_FADE_CLASS, className)}
    >
      {showHeader ? (
        // The settings chrome owns the page title (h1); repeating it here, even visually
        // hidden, makes screen readers announce the title twice.
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">{description}</p>
              {status}
            </div>
            {primaryAction ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{primaryAction}</div>
            ) : null}
          </div>

          {visibleMetrics.length > 0 ? (
            <dl
              aria-label={`${title} summary`}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {visibleMetrics.map((item) => {
                const Icon = item.Icon;
                return (
                  <div
                    key={item.label}
                    className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/70 bg-card p-3"
                  >
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
                      {item.label}
                    </dt>
                    <dd className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={item.variant ?? 'secondary'} className="max-w-full">
                        {item.value}
                      </Badge>
                      {item.description ? (
                        <span className="min-w-0 break-words text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </div>
      ) : null}

      <SettingsSectionNav
        title={railTitle}
        description={railDescription}
        items={railItems}
        footer={footer}
        className={railClassName}
      />

      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
