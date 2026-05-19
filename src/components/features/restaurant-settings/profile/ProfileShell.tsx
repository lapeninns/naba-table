'use client';

import { SettingsSectionNav, SETTINGS_COMMAND_CENTER_LAYOUT_CLASS } from '../shared';

import type { RestaurantSettingsCommandRailItem } from '../shared';
import type { ReactNode } from 'react';

type ProfileShellProps = {
  railItems?: RestaurantSettingsCommandRailItem[];
  children: ReactNode;
};

/**
 * Shared compact frame around every Profile state (loaded, loading,
 * error, no-restaurant). Keeps editing directly under the page heading.
 */
export function ProfileShell({ railItems, children }: ProfileShellProps) {
  return (
    <section className={SETTINGS_COMMAND_CENTER_LAYOUT_CLASS} aria-label="Profile sections">
      <SettingsSectionNav title="Profile sections" showHeader={false} items={railItems} />
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
