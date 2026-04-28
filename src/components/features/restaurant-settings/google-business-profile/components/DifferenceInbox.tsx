'use client';

import { AlertTriangle, ChevronRight, Inbox, Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
  formatWorkflowStatus,
  workflowStatusVariant,
  type DirectionSectionSummary,
} from '../lib/sync-review';

type DifferenceInboxProps = {
  summaries: DirectionSectionSummary[];
  selectedSectionKey: string | null;
  onSelect: (sectionKey: string) => void;
};

export function DifferenceInbox({ summaries, selectedSectionKey, onSelect }: DifferenceInboxProps) {
  return (
    <div className="flex h-full min-h-[320px] min-w-0 flex-col">
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Change groups
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Review profile sections with changes before the final check.
            </p>
          </div>
          <Badge variant="secondary">{summaries.length}</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {summaries.length > 0 ? (
            summaries.map((summary) => {
              const isSelected = selectedSectionKey === summary.section.sectionKey;
              return (
                <button
                  key={summary.section.sectionKey}
                  type="button"
                  onClick={() => onSelect(summary.section.sectionKey)}
                  className={cn(
                    'w-full min-w-0 rounded-lg border px-3 py-3 text-left transition-colors',
                    isSelected
                      ? 'border-foreground/20 bg-muted shadow-sm'
                      : 'border-border/60 bg-background hover:bg-muted/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        {summary.blockedCount > 0 || summary.section.status === 'stale' ? (
                          <AlertTriangle className="size-4 text-amber-600" />
                        ) : (
                          <Layers3 className="size-4 text-muted-foreground" />
                        )}
                        <p className="truncate text-sm font-medium text-foreground">
                          {summary.section.label}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {summary.selectedCount}/{summary.actionableCount} chosen
                        </span>
                        {summary.oppositeDirectionCount > 0 ? (
                          <span>{summary.oppositeDirectionCount} chosen for the other path</span>
                        ) : null}
                        {summary.ignoredCount > 0 ? (
                          <span>{summary.ignoredCount} ignored</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge
                        className="max-w-[8rem] truncate"
                        variant={workflowStatusVariant(summary.section.status)}
                      >
                        {formatWorkflowStatus(summary.section.status)}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
                <Inbox className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No changes to review</p>
                <p className="text-xs text-muted-foreground">
                  Check for changes to compare Google Business Profile with Nabatable.
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
