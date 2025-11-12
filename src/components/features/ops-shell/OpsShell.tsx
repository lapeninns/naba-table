'use client';

import type { ReactNode } from 'react';

import { OpsSidebarLayout } from './OpsSidebarLayout';

type OpsShellProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
};

export function OpsShell({ children, defaultSidebarOpen }: OpsShellProps) {
  return <OpsSidebarLayout defaultSidebarOpen={defaultSidebarOpen}>{children}</OpsSidebarLayout>;
}
