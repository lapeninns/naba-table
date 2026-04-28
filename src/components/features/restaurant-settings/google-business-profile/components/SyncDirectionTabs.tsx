'use client';

import { ArrowRightLeft, GitPullRequestArrow, Send } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  SYNC_DIRECTION_OPTIONS,
  type DirectionStats,
  type SyncPublishDirection,
} from '../lib/sync-review';

type SyncDirectionTabsProps = {
  direction: SyncPublishDirection;
  onDirectionChange: (direction: SyncPublishDirection) => void;
  stats: Record<SyncPublishDirection, DirectionStats>;
  hasMixedSelections: boolean;
};

export function SyncDirectionTabs({
  direction,
  onDirectionChange,
  stats,
  hasMixedSelections,
}: SyncDirectionTabsProps) {
  return (
    <div className="space-y-3">
      <Tabs
        value={direction}
        onValueChange={(value) => onDirectionChange(value as SyncPublishDirection)}
      >
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-transparent p-0 md:grid-cols-2">
          {SYNC_DIRECTION_OPTIONS.map((option) => {
            const directionStats = stats[option.value];
            const Icon = option.value === 'google_to_nabatable' ? GitPullRequestArrow : Send;

            return (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="h-auto items-start justify-between rounded-lg border border-border/70 bg-background px-4 py-3 text-left data-[state=active]:border-foreground/20 data-[state=active]:shadow-sm"
                data-testid={`gbp-direction-tab-${option.value}`}
              >
                <span className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4" />
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="tabular-nums">
                    {directionStats.selectedCount}/{directionStats.actionableCount}
                  </Badge>
                  {directionStats.blockedCount > 0 ? (
                    <span>{directionStats.blockedCount} blocked</span>
                  ) : null}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {hasMixedSelections ? (
        <Alert>
          <ArrowRightLeft className="size-4" />
          <AlertTitle>Apply one update path at a time</AlertTitle>
          <AlertDescription>
            You have chosen changes for both paths. Run the final check and apply the current tab,
            then switch tabs for the other path.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
