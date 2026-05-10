'use client';

import { Fragment } from 'react';

import { useOpsSession } from '@/contexts/ops-session';

import { OpsSidebarLayout } from './OpsSidebarLayout';

import type { ReactNode } from 'react';

type OpsShellProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
  /** Shown under the Ops header when set (e.g. staging read-replica or custom notice). */
  envBanner?: string | null;
};

export function OpsShell({ children, defaultSidebarOpen, envBanner }: OpsShellProps) {
  const { user, activeRestaurantId } = useOpsSession();
  const contentScopeKey = `${user?.id ?? 'anonymous'}:${activeRestaurantId ?? 'none'}`;

  return (
    <OpsSidebarLayout defaultSidebarOpen={defaultSidebarOpen} envBanner={envBanner}>
      <Fragment key={contentScopeKey}>{children}</Fragment>
    </OpsSidebarLayout>
  );
}
