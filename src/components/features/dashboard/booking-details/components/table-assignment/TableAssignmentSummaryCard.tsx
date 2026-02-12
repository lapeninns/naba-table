'use client';

import { CheckCircle2, Loader2, Sparkles, Trash2, Users } from 'lucide-react';
import { useId, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
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
  const percent = useMemo(() => Math.min((totalSeated / Math.max(1, partySize)) * 100, 100), [partySize, totalSeated]);
  const helperId = useId();

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg shadow-sm',
                  totalSeated >= partySize ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                )}
              >
                <Users className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <div className="text-base font-bold text-foreground leading-none">{partySize} Covers</div>
                <div className="text-xs text-muted-foreground">
                  {totalSeated >= partySize ? 'Capacity met' : `Need ${partySize - totalSeated} more`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground leading-none">
                {totalSeated}
                <span className="text-sm font-medium text-muted-foreground">/{partySize}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Seated</div>
            </div>
          </div>
          <Progress
            value={percent}
            aria-label="Seating capacity progress"
            className={cn(
              'h-2.5 bg-muted',
              totalSeated >= partySize ? '[&>div]:bg-emerald-600' : '[&>div]:bg-amber-600',
            )}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={initialFocusRef}
              variant="outline"
              size="sm"
              onClick={onSmartAssign}
              disabled={isPending}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden />
              Smart assign
            </Button>

            {selectedCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelected}
                disabled={isPending}
              >
                Clear ({selectedCount})
              </Button>
            ) : null}

            {assignedCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetAssigned}
                disabled={isPending}
                className="text-rose-700 hover:text-rose-800 hover:bg-rose-50"
              >
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                Reset ({assignedCount})
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Button
              size="sm"
              onClick={onConfirmApply}
              disabled={isApplyDisabled || isPending}
              aria-describedby={isApplyBlocked && applyDisabledReason ? helperId : undefined}
              className="h-9 w-full bg-emerald-600 font-semibold hover:bg-emerald-700 sm:w-auto"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
              )}
              Confirm assignment
            </Button>

            {isApplyBlocked && applyDisabledReason ? (
              <div id={helperId} className="text-xs text-muted-foreground">
                {applyDisabledReason}{' '}
                <Badge variant="outline" className="ml-1 text-[10px]">
                  See errors above
                </Badge>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TableAssignmentSummaryCard;
