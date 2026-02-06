'use client';

import { useMemo } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import type { FlattenedTable } from '../../utils';

export type GuestSeatingCardProps = {
  assignedTableRows: FlattenedTable[];
  totalCapacity: number;
  capacityPercent: number;
  partySize: number;
  seatingPreference?: string | null;
};

export function GuestSeatingCard({
  assignedTableRows,
  totalCapacity,
  capacityPercent,
  partySize,
  seatingPreference,
}: GuestSeatingCardProps) {
  const tableLabels = useMemo(() => assignedTableRows.map((t) => t.tableNumber), [assignedTableRows]);
  const visibleTables = tableLabels.slice(0, 3);
  const overflowCount = Math.max(0, tableLabels.length - visibleTables.length);

  if (assignedTableRows.length === 0) {
    return (
      <Alert className="border-amber-200 bg-warning/10 text-warning-foreground">
        <AlertTitle className="text-amber-900">No table assigned</AlertTitle>
        <AlertDescription className="text-amber-800/90">
          Assign a table to complete the seating plan.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-slate-200/60 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assigned tables
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {visibleTables.map((tableNumber) => (
              <Badge key={tableNumber} variant="secondary" className="text-xs font-semibold">
                {tableNumber}
              </Badge>
            ))}
            {overflowCount > 0 ? (
              <Badge variant="outline" className="text-xs">
                +{overflowCount}
              </Badge>
            ) : null}
          </div>
        </div>

        <Progress value={capacityPercent} className="h-2 bg-muted" />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Capacity</span>
          <span
            className={cn(
              'font-semibold',
              capacityPercent >= 100
                ? 'text-emerald-700'
                : capacityPercent >= 80
                  ? 'text-amber-700'
                  : 'text-muted-foreground',
            )}
          >
            {totalCapacity} / {partySize} seats
          </span>
        </div>

        {seatingPreference ? (
          <div className="pt-1">
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
              {seatingPreference}
            </Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default GuestSeatingCard;

