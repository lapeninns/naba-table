'use client';

import { CheckCircle2, Loader2, Sparkles, Trash2, Users } from 'lucide-react';
import { useId, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type TableAssignmentSummaryCardProps = {
  partySize: number;
  selectedCapacity: number;
  assignedCapacity: number;
  selectedCount: number;
  assignedCount: number;
  isPending: boolean;
  isApplyBlocked: boolean;
  isApplyDisabled: boolean;
  applyDisabledReason: string | null;
  onSmartAssign: () => void;
  onClearSelected: () => void;
  onResetAssigned: () => void;
  onConfirmApply: () => void;
  initialFocusRef?: React.RefObject<HTMLButtonElement | null>;
};

export function TableAssignmentSummaryCard({
  partySize,
  selectedCapacity,
  assignedCapacity,
  selectedCount,
  assignedCount,
  isPending,
  isApplyBlocked,
  isApplyDisabled,
  applyDisabledReason,
  onSmartAssign,
  onClearSelected,
  onResetAssigned,
  onConfirmApply,
  initialFocusRef,
}: TableAssignmentSummaryCardProps) {
  const totalSeated = selectedCapacity + assignedCapacity;
  const percent = useMemo(
    () => Math.min((totalSeated / Math.max(1, partySize)) * 100, 100),
    [partySize, totalSeated],
  );
  const helperId = useId();

  return (
    <Card className="overflow-hidden border-border/60 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="space-y-4 p-3.5">
        <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
                <Users className="size-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-foreground">
                {partySize} Covers
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold tracking-tighter text-foreground">
                {totalSeated}
                <span className="text-xs font-medium text-muted-foreground/60">/{partySize}</span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Progress value={percent} className="h-1.5 bg-muted/50" />
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
              <span className="text-muted-foreground/60">Seating Capacity</span>
              <span
                className={cn(
                  totalSeated >= partySize ? 'text-primary' : 'text-muted-foreground/80',
                )}
              >
                {totalSeated >= partySize ? 'Met' : `${Math.round(percent)}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              ref={initialFocusRef}
              variant="outline"
              size="sm"
              onClick={onSmartAssign}
              disabled={isPending}
              className="h-8 flex-1 gap-1.5 border-primary/20 bg-background text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-primary/5"
            >
              <Sparkles className="size-3 text-primary" />
              Smart
            </Button>

            <Button
              size="sm"
              onClick={onConfirmApply}
              disabled={isApplyDisabled || isPending}
              className="h-8 flex-1 bg-primary text-[10px] font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Assign
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
            <div className="flex gap-1">
              {selectedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  onClick={onClearSelected}
                  disabled={isPending}
                >
                  Clear ({selectedCount})
                </Button>
              )}
              {assignedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetAssigned}
                  disabled={isPending}
                  className="h-6 px-1.5 text-[9px] font-bold uppercase tracking-widest text-destructive hover:bg-destructive/5 hover:text-destructive"
                >
                  <Trash2 className="size-3 mr-1" />
                  Reset ({assignedCount})
                </Button>
              )}
            </div>
          </div>
        </div>

        {isApplyBlocked && applyDisabledReason && (
          <div
            id={helperId}
            className="rounded bg-destructive/5 p-2 text-[10px] font-medium leading-tight text-destructive/80"
          >
            {applyDisabledReason}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TableAssignmentSummaryCard;
