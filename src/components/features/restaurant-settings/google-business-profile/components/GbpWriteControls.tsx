'use client';

import { ChevronDown, CircleSlash, OctagonAlert, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Text } from '@/components/ui/typography';
import { useOpsGbpOperatorState } from '@/hooks/ops/useOpsGoogleBusinessProfile';
import { cn } from '@/lib/utils';

import { GbpOperatorControls } from './GbpOperatorControls';

export type GbpWriteControlsProps = {
  readonly restaurantId: string;
  /** Write state and the password-confirmed switches are admin-only (current gating). */
  readonly canManageSettings: boolean;
  /** Pause/resume and queued-publish controls from the review workspace, when it is available. */
  readonly syncControls?: ReactNode;
  /** Lazy operational panels (health, pending changes, queue recovery, publishes, operations). */
  readonly operationalPanels?: ReactNode;
  readonly onRequestRefresh?: () => void;
  readonly refreshPending?: boolean;
};

/**
 * "Write controls and evidence": collapsed by default, and opened automatically when Google's
 * pending changes are unknown so the fail-stop is never hidden.
 */
export function GbpWriteControls({
  restaurantId,
  canManageSettings,
  syncControls,
  operationalPanels,
  onRequestRefresh,
  refreshPending,
}: GbpWriteControlsProps) {
  const operator = useOpsGbpOperatorState(canManageSettings ? restaurantId : null);
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const state = canManageSettings
    ? (operator.connectionQuery.data ?? operator.setWriteAccessMutation.data ?? null)
    : null;
  const failStop = state?.pendingUpdates.state === 'unknown';
  const open = openChoice ?? failStop;

  return (
    <Card variant="compact" className="min-w-0 border-border/70 shadow-none">
      <Collapsible open={open} onOpenChange={setOpenChoice}>
        <h2>
          <CollapsibleTrigger
            className={cn(
              'group flex w-full items-start justify-between gap-3 rounded-lg px-4 py-4 text-left sm:px-5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              <ChevronDown
                className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
              <span className="flex min-w-0 flex-col gap-1">
                <Text as="span" variant="subheading" className="text-sm">
                  Write controls and evidence
                </Text>
                <Text as="span" variant="caption">
                  For admins and on-call staff. Shows what gates a publish to Google.
                </Text>
              </span>
            </span>
            {state ? (
              <span className="flex shrink-0 flex-wrap justify-end gap-2">
                {failStop ? (
                  <OpsStatusBadge tone="danger" icon={OctagonAlert} label="Publishing stopped" />
                ) : null}
                {state.writeState === 'eligible' ? (
                  <OpsStatusBadge tone="success" icon={ShieldCheck} label="Writes on" />
                ) : (
                  <OpsStatusBadge tone="muted" icon={CircleSlash} label="Writes off" />
                )}
              </span>
            ) : null}
          </CollapsibleTrigger>
        </h2>
        <CollapsibleContent className="flex min-w-0 flex-col gap-4 border-t border-border/60 px-4 py-4 sm:px-5">
          {canManageSettings ? (
            <GbpOperatorControls
              operator={operator}
              onRequestRefresh={onRequestRefresh}
              refreshPending={refreshPending}
            />
          ) : null}
          {syncControls ? (
            <section
              aria-label="Sync controls"
              className={cn(
                'flex flex-col gap-2',
                canManageSettings && 'border-t border-border/60 pt-4',
              )}
            >
              {syncControls}
            </section>
          ) : null}
          {operationalPanels ? (
            <section aria-label="Operational evidence" className="flex flex-col gap-2">
              {operationalPanels}
            </section>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
