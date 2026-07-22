'use client';

import { OpsShell } from '@/components/features/ops-shell';
import { Heading, Text } from '@/components/ui/typography';

import { OpsDevProviders } from '../../_shared/OpsDevProviders';

export function OpsNavigationDevHarness() {
  return (
    <OpsDevProviders>
      <OpsShell defaultSidebarOpen>
        <main className="flex min-h-[calc(100vh-3.5rem)] flex-col gap-4 px-6 py-6">
          <div className="max-w-3xl space-y-2">
            <Heading variant="title" as="h1">Ops navigation dev harness</Heading>
            <Text variant="caption">
              Use this route to verify sidebar section labels, item order, and feature-flagged entries without the authenticated app shell.
            </Text>
          </div>
        </main>
      </OpsShell>
    </OpsDevProviders>
  );
}
