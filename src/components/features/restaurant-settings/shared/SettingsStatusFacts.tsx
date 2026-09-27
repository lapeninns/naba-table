import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { SETTINGS_STATUS_ROW_CLASS } from './compactSettingsClasses';

import type { ReactNode } from 'react';

export type SettingsStatusBadgeVariant =
  | 'status-confirmed'
  | 'status-pending'
  | 'status-completed'
  | 'status-cancelled';

export type SettingsStatusFactsProps = {
  /** Optional leading status pill. */
  badge?: { label: ReactNode; variant: SettingsStatusBadgeVariant; icon?: ReactNode };
  /** Facts in text-xs muted, e.g. `<span>12 tables</span>`. */
  children?: ReactNode;
  /** Announce changes politely (role=status). Off by default for static facts. */
  live?: boolean;
  className?: string;
};

/**
 * Page status row for settings pages without a page-wide draft (Menu, Tables, Team, setup).
 * Same row as `SettingsStatusLine`: an optional status Badge, then muted facts.
 */
export function SettingsStatusFacts({
  badge,
  children,
  live = false,
  className,
}: SettingsStatusFactsProps) {
  return (
    <div
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      data-slot="settings-status-facts"
      className={cn(SETTINGS_STATUS_ROW_CLASS, className)}
    >
      {badge ? (
        <Badge variant={badge.variant} className={cn(badge.icon ? 'gap-1' : undefined)}>
          {badge.icon}
          {badge.label}
        </Badge>
      ) : null}
      {children}
    </div>
  );
}
