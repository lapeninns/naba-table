'use client';

import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import { useOpsSession } from '@/contexts/ops-session';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import { isRestaurantSettingsPathname } from './isRestaurantSettingsPathname';
import { OpsSidebarLayout } from './OpsSidebarLayout';

import type { ReactNode } from 'react';

type OpsShellProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  /** Shown under the Ops header when set (e.g. staging read-replica or custom notice). */
  envBanner?: string | null;
};

export function OpsShell({ children, defaultSidebarOpen, envBanner }: OpsShellProps) {
  const pathname = usePathname();
  const { user, activeRestaurantId } = useOpsSession();
  const contentScopeKey = `${user?.id ?? 'anonymous'}:${activeRestaurantId ?? 'none'}`;
  const isFocusedRestaurantSettings = isRestaurantSettingsPathname(pathname);

  return (
    <OpsUnsavedChangesProvider>
      {isFocusedRestaurantSettings ? (
        <Fragment key={contentScopeKey}>{children}</Fragment>
      ) : (
        <OpsSidebarLayout defaultSidebarOpen={defaultSidebarOpen} envBanner={envBanner}>
          <Fragment key={contentScopeKey}>{children}</Fragment>
        </OpsSidebarLayout>
      )}
    </OpsUnsavedChangesProvider>
  );
}
