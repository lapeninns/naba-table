'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

export type OpsStatusBadgeProps = {
  label: ReactNode;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
  className?: string;
};

const toneClasses: Record<NonNullable<OpsStatusBadgeProps['tone']>, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  info: 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/10 dark:text-primary',
  success: 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/10 dark:text-primary',
  warning: 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/10 dark:text-primary',
  danger:
    'bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/10 dark:text-destructive',
  muted: 'bg-muted text-muted-foreground border-border/60',
};

export function OpsStatusBadge({ label, tone = 'default', className }: OpsStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('rounded-md border text-xs font-medium', toneClasses[tone], className)}
    >
      {label}
    </Badge>
  );
}
