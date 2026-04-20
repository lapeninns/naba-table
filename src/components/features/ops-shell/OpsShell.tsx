'use client';

import { Fragment } from 'react';

import { useOpsSession } from '@/contexts/ops-session';

import { OpsSidebarLayout } from './OpsSidebarLayout';

import type { ReactNode } from 'react';

type OpsShellProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
};

export function OpsShell({ children, defaultSidebarOpen }: OpsShellProps) {
  const { user, activeRestaurantId } = useOpsSession();
  const contentScopeKey = `${user?.id ?? 'anonymous'}:${activeRestaurantId ?? 'none'}`;

  return (
    <OpsSidebarLayout defaultSidebarOpen={defaultSidebarOpen}>
      <Fragment key={contentScopeKey}>{children}</Fragment>
    </OpsSidebarLayout>
  );
}
