'use client';

import { OpsShell } from '@/components/features/ops-shell';

import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsNavigationDevHarness() {
  return (
    <OpsDevProviders>
      <OpsShell defaultSidebarOpen>
        <main className="flex min-h-[calc(100vh-3.5rem)] flex-col gap-4 px-6 py-6">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Ops navigation dev harness</h1>
            <p className="text-sm text-muted-foreground">
              Use this route to verify sidebar section labels, item order, and feature-flagged entries without the authenticated app shell.
            </p>
          </div>
        </main>
      </OpsShell>
    </OpsDevProviders>
  );
}
