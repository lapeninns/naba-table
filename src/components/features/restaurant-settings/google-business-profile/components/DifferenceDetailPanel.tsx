'use client';

import { Eye } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

import { FieldDecisionRow } from './FieldDecisionRow';
import {
  formatWorkflowStatus,
  workflowStatusVariant,
  type DirectionSectionSummary,
  type FieldDecision,
} from '../lib/sync-review';

import type { GoogleBusinessProfileActivePublishJob } from '@/services/ops/restaurants';

type DifferenceDetailPanelProps = {
  summary: DirectionSectionSummary | null;
  getDecisionForItem: (fieldKey: string) => FieldDecision;
  onDecisionChange: (fieldKey: string, decision: FieldDecision) => void;
  activePublishJob: GoogleBusinessProfileActivePublishJob | null;
  googlePushEnabled: boolean;
};

export function DifferenceDetailPanel({
  summary,
  getDecisionForItem,
  onDecisionChange,
  activePublishJob,
  googlePushEnabled,
}: DifferenceDetailPanelProps) {
  if (!summary) {
    return (
      <div className="flex min-h-[320px] min-w-0 items-center justify-center px-6 py-10 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/50">
            <Eye className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Select a section</p>
            <p className="text-xs text-muted-foreground">
              Choose a change group to review each field.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] min-w-0 flex-col">
      <div className="border-b border-border/60 bg-background px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 text-wrap text-base font-semibold text-foreground">
                {summary.section.label}
              </h3>
              <Badge variant={workflowStatusVariant(summary.section.status)}>
                {formatWorkflowStatus(summary.section.status)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{summary.section.summary}</p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 text-xs text-muted-foreground lg:justify-end">
            <Badge variant="secondary">
              {summary.selectedCount}/{summary.actionableCount} chosen
            </Badge>
            {summary.oppositeDirectionCount > 0 ? (
              <Badge variant="outline">{summary.oppositeDirectionCount} other path</Badge>
            ) : null}
            {summary.ignoredCount > 0 ? (
              <Badge variant="outline">{summary.ignoredCount} ignored</Badge>
            ) : null}
            {summary.unchangedCount > 0 ? (
              <Badge variant="outline">{summary.unchangedCount} unchanged</Badge>
            ) : null}
          </div>
        </div>
        {summary.section.blockedReasons.length > 0 ? (
          <Alert
            className="mt-3"
            variant={summary.section.status === 'stale' ? 'destructive' : 'default'}
          >
            <AlertTitle>
              {summary.section.status === 'stale' ? 'Check for changes again' : 'Section notes'}
            </AlertTitle>
            <AlertDescription>{summary.section.blockedReasons.join(' ')}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {summary.changedItems.map((item) => {
            const inActiveJob = Boolean(activePublishJob?.selectedApprovals[item.fieldKey]);
            return (
              <FieldDecisionRow
                key={item.fieldKey}
                item={item}
                section={summary.section}
                decision={getDecisionForItem(item.fieldKey)}
                onDecisionChange={(decision) => onDecisionChange(item.fieldKey, decision)}
                jobStatus={inActiveJob ? (activePublishJob?.status ?? null) : null}
                googlePushEnabled={googlePushEnabled}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
