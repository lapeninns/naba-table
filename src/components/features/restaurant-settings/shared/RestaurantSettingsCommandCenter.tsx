'use client';

import { ArrowRight, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { ComponentProps, ReactNode } from 'react';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

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
  primaryAction?: ReactNode;
  railTitle?: string;
  railDescription?: string;
  railItems?: RestaurantSettingsCommandRailItem[];
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function RestaurantSettingsCommandCenter({
  eyebrow,
  title,
  description,
  metrics = [],
  primaryAction,
  railTitle = 'Workflow',
  railDescription,
  railItems = [],
  children,
  footer,
  className,
}: RestaurantSettingsCommandCenterProps) {
  const hasRail = railItems.length > 0 || footer;

  return (
    <section className={cn('grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]', className)}>
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <Badge variant="outline" className="w-fit">
                {eyebrow}
              </Badge>
              <div className="space-y-1">
                <CardTitle className="text-2xl leading-tight">{title}</CardTitle>
                <CardDescription className="max-w-3xl text-sm leading-6">
                  {description}
                </CardDescription>
              </div>
            </div>
            {primaryAction ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{primaryAction}</div>
            ) : null}
          </CardHeader>

          {metrics.length > 0 ? (
            <CardContent className="border-t border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {metrics.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <div key={item.label} className="min-w-0 rounded-md border bg-background p-3">
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

        {children}
      </div>

      {hasRail ? (
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="gap-1 px-4 py-3">
              <CardTitle className="text-base">{railTitle}</CardTitle>
              {railDescription ? (
                <CardDescription className="text-xs leading-5">{railDescription}</CardDescription>
              ) : null}
            </CardHeader>
            {railItems.length > 0 ? (
              <CardContent className="flex flex-col gap-1 px-2 pb-3">
                {railItems.map((item) => {
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
                        type="button"
                        variant="ghost"
                        aria-current={item.isActive ? 'page' : undefined}
                        onClick={item.onSelect}
                        className={cn(
                          'h-auto items-start justify-start gap-3 whitespace-normal px-2 py-2 text-left',
                          item.isActive && 'bg-primary/10 text-foreground',
                        )}
                      >
                        {content}
                      </Button>
                    );
                  }

                  return (
                    <Button
                      key={itemKey}
                      asChild
                      variant="ghost"
                      aria-current={item.isActive ? 'page' : undefined}
                      className={cn(
                        'h-auto items-start justify-start gap-3 whitespace-normal px-2 py-2 text-left',
                        item.isActive && 'bg-primary/10 text-foreground',
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
        </aside>
      ) : null}
    </section>
  );
}
