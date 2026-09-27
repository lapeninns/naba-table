import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';

import type { ReactNode } from 'react';

export const SETTINGS_NO_RESTAURANT_TITLE = 'Select a restaurant';

export function formatSettingsNoRestaurantDescription(task: string): string {
  return `Choose a restaurant with the sidebar switcher to ${task}.`;
}

export type SettingsNoRestaurantStateProps = {
  /** Verb phrase finishing "Choose a restaurant with the sidebar switcher to …", e.g. "edit its public details". */
  task?: string;
  /** Full description; overrides `task`. */
  description?: string;
  icon?: ReactNode;
  className?: string;
};

/** Empty state shown when no restaurant is selected. */
export function SettingsNoRestaurantState({
  task = 'manage its settings',
  description,
  icon,
  className,
}: SettingsNoRestaurantStateProps) {
  return (
    <OpsEmptyState
      title={SETTINGS_NO_RESTAURANT_TITLE}
      description={description ?? formatSettingsNoRestaurantDescription(task)}
      icon={icon}
      className={className}
    />
  );
}
