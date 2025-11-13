'use client';

import { OpsSidebarLayout } from './OpsSidebarLayout';

import type { ReactNode } from 'react';


type OpsShellProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
};

export function OpsShell({ children, defaultSidebarOpen }: OpsShellProps) {
  return <OpsSidebarLayout defaultSidebarOpen={defaultSidebarOpen}>{children}</OpsSidebarLayout>;
}
