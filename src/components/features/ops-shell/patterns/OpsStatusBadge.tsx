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
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300',
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
