'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type OpsEmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function OpsEmptyState({
  title,
  description,
  icon,
  action,
  className,
}: OpsEmptyStateProps) {
  return (
    <Card
      className={cn(
        'flex min-h-[240px] flex-col items-center justify-center gap-3 border-dashed border-border/60 bg-muted/20 p-6 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </Card>
  );
}
