'use client';

import { Card } from '@/components/ui/card';
import { Heading, Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type OpsEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  /**
   * `compact` is for an empty state inside a titled card or panel: no minimum height, tighter
   * padding and a text-sm medium title, so it never outranks the card title above it.
   * `default` is the page-level empty state.
   */
  size?: 'default' | 'compact';
};

export function OpsEmptyState({
  title,
  description,
  icon,
  action,
  className,
  size = 'default',
}: OpsEmptyStateProps) {
  const compact = size === 'compact';
  return (
    <Card
      data-slot="ops-empty-state"
      data-size={size}
      className={cn(
        'flex flex-col items-center justify-center border-dashed border-border/60 bg-muted/20 text-center',
        compact ? 'gap-2 px-4 py-6' : 'min-h-[240px] gap-3 p-6',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex items-center justify-center bg-muted/60 text-muted-foreground',
            compact ? 'size-9 rounded-xl' : 'size-12 rounded-2xl',
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <Heading
          variant="title"
          as="h3"
          className={cn(
            'text-foreground',
            compact && 'text-sm font-medium leading-5 tracking-normal',
          )}
        >
          {title}
        </Heading>
        {description ? (
          <Text
            variant="caption"
            className={cn(compact && 'text-sm leading-5 text-muted-foreground')}
          >
            {description}
          </Text>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </Card>
  );
}
