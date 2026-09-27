'use client';

import {
  OpsEmptyState,
  type OpsEmptyStateProps,
} from '@/components/features/ops-shell/patterns/OpsEmptyState';

export type SettingsCardEmptyStateProps = Omit<OpsEmptyStateProps, 'size'>;

/**
 * Empty state inside a `SettingsCard` or titled settings panel (RR10): the compact
 * `OpsEmptyState`, whose text-sm medium title never outranks the card's text-base title.
 * Use the default `OpsEmptyState` only for a page-level empty state with no card around it.
 */
export function SettingsCardEmptyState(props: SettingsCardEmptyStateProps) {
  return <OpsEmptyState {...props} size="compact" />;
}
