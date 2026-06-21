'use client';

import {
  Loader2,
  Trash2,
  Users,
  Eye,
  EyeOff,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { ManualSelectionCheck } from '@/services/ops/bookings';

type AssignmentToolbarProps = {
  selectedCount: number;
  selectedCapacity: number;
  partySize?: number;
  zoneId?: string | null;
  validationChecks: ManualSelectionCheck[];
  onAssign: () => void;
  onClear: () => void;
  isPending: boolean;
  isAssigning: boolean;
  canAssign: boolean;
  assignDisabledReason?: string | null;
  onlyAvailable?: boolean;
  onOnlyAvailableChange?: (value: boolean) => void;
};

export function AssignmentToolbar({
  selectedCount,
  selectedCapacity,
  partySize,
  zoneId,
  validationChecks: _validationChecks,
  onAssign,
  onClear,
  isPending,
  isAssigning,
  canAssign,
  assignDisabledReason,
  onlyAvailable,
  onOnlyAvailableChange,
}: AssignmentToolbarProps) {
  const capacityStatus = partySize
    ? selectedCapacity >= partySize
      ? 'sufficient'
      : 'insufficient'
    : 'unknown';

  const capacityDiff = partySize ? selectedCapacity - partySize : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Card */}
      <Card className="border-2 shadow-md">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Party Size */}
            {partySize && (
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/10 shadow-sm">
                  <Users className="size-7 text-primary dark:text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Party
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">{partySize}</p>
                </div>
              </div>
            )}

            {/* Selected Tables */}
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/10 shadow-sm">
                <LayoutGrid className="size-7 text-primary dark:text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Selected
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-3xl font-bold tabular-nums text-foreground">{selectedCount}</p>
                  <p className="text-sm text-muted-foreground font-medium">
                    {selectedCount === 1 ? 'table' : 'tables'}
                  </p>
                </div>
              </div>
            </div>

            {/* Capacity */}
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex size-14 items-center justify-center rounded-xl border-2 shadow-sm transition-colors',
                  capacityStatus === 'sufficient'
                    ? 'border-primary/30 bg-primary/10'
                    : capacityStatus === 'insufficient'
                      ? 'border-destructive/20 bg-destructive/10'
                      : 'border-border bg-muted/40',
                )}
              >
                {capacityStatus === 'sufficient' ? (
                  <CheckCircle2 className="size-7 text-primary dark:text-primary" />
                ) : capacityStatus === 'insufficient' ? (
                  <AlertCircle className="size-7 text-destructive dark:text-destructive" />
                ) : (
                  <Users className="size-7 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Capacity
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p
                    className={cn(
                      'text-3xl font-bold tabular-nums transition-colors',
                      capacityStatus === 'sufficient'
                        ? 'text-primary dark:text-primary'
                        : capacityStatus === 'insufficient'
                          ? 'text-destructive dark:text-destructive'
                          : 'text-foreground',
                    )}
                  >
                    {selectedCapacity}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">seats</p>
                </div>
                {partySize && capacityDiff !== 0 && (
                  <p
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      capacityDiff > 0
                        ? 'text-primary dark:text-primary'
                        : 'text-destructive dark:text-destructive',
                    )}
                  >
                    {capacityDiff > 0 ? '+' : ''}
                    {capacityDiff} {Math.abs(capacityDiff) === 1 ? 'seat' : 'seats'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Zone Badge */}
          {zoneId && (
            <div className="mt-4 pt-4 border-t">
              <Badge variant="outline" className="text-xs font-medium px-3 py-1">
                🎯 Zone: {zoneId}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Bar */}
      <div className="pg-assignment-actions-bar flex items-center justify-between gap-3 rounded-xl border-2 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {onOnlyAvailableChange && (
            <div className="flex items-center gap-2.5">
              <Switch
                id="only-available"
                checked={onlyAvailable ?? false}
                onCheckedChange={onOnlyAvailableChange}
                disabled={isPending}
                aria-label="Show only available tables"
                className="data-[state=checked]:bg-primary"
              />
              <Label
                htmlFor="only-available"
                className="text-sm font-medium cursor-pointer flex items-center gap-2 text-foreground select-none"
              >
                {onlyAvailable ? (
                  <Eye className="size-4 text-primary" />
                ) : (
                  <EyeOff className="size-4 text-muted-foreground" />
                )}
                <span>Available only</span>
              </Label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="outline"
              size="default"
              onClick={onClear}
              disabled={isPending}
              className="h-11 px-4 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium transition-[color,background-color,border-color,box-shadow,transform]"
              title="Clear selection"
              aria-label="Clear table selection"
            >
              <Trash2 className="size-4 mr-2" aria-hidden />
              Clear
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="default"
                    onClick={onAssign}
                    disabled={!canAssign || isPending}
                    className={cn(
                      'h-11 w-full sm:w-auto sm:min-w-[150px] font-semibold shadow-md transition-[transform,box-shadow,background-color,color]',
                      canAssign
                        ? 'pg-assignment-primary-action hover:shadow-lg active:scale-95'
                        : 'opacity-50',
                    )}
                    aria-label={
                      canAssign
                        ? 'Assign tables to booking instantly'
                        : assignDisabledReason || 'Cannot assign tables'
                    }
                  >
                    {isAssigning ? (
                      <>
                        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                        Assigning…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 size-5" aria-hidden />
                        Assign Tables
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {assignDisabledReason && (
                <TooltipContent>
                  <p>{assignDisabledReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
