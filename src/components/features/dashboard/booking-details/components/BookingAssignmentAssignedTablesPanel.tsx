'use client';

import { CheckCircle2, Info, LayoutGrid, MapPin, Trash2, Users, X } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

export type BookingAssignmentAssignedTablesPanelProps = {
  assignedTables: ManualAssignmentTable[];
  canUnassignSingleTable: boolean;
  onRequestUnassignTable: (tableId: string) => void;
  onRemoveAllTables: () => void;
};

export function BookingAssignmentAssignedTablesPanel({
  assignedTables,
  canUnassignSingleTable,
  onRequestUnassignTable,
  onRemoveAllTables,
}: BookingAssignmentAssignedTablesPanelProps) {
  if (assignedTables.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground shadow-sm">
        No tables assigned yet. Select tables on the left to match the party size.
      </div>
    );
  }

  const totalSeats = assignedTables.reduce((sum, table) => sum + table.capacity, 0);
  const assignmentCountLabel = assignedTables.length === 1 ? 'table' : 'tables';

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm animate-in fade-in-50"
      role="region"
      aria-label="Currently assigned tables"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-success/20 bg-success/10 shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground">Assigned Tables</h4>
            <p className="text-xs text-muted-foreground">{totalSeats} total seats</p>
          </div>
          <Badge variant="outline" className="px-2 py-1 font-mono text-xs">
            {assignedTables.length} {assignmentCountLabel}
          </Badge>
        </div>

        {assignedTables.length > 1 ? (
          <Button
            variant="outline"
            size="default"
            className="h-10 border-destructive/30 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemoveAllTables}
            aria-label="Remove all assigned tables"
          >
            <Trash2 data-icon="inline-start" aria-hidden />
            Remove All
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {assignedTables.map((table) => (
          <div
            key={table.id}
            className="group relative rounded-xl border-2 border-primary/20 bg-primary/5 p-4 shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-200 animate-in fade-in-50 slide-in-from-bottom-2 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="absolute right-3 top-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <LayoutGrid className="h-5 w-5 text-primary" strokeWidth={2} />
              </div>
            </div>

            <div className="flex flex-col gap-3 pr-14">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Table
                </p>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {table.tableNumber}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{table.capacity} seats</span>
                </div>
                {table.section ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{table.section}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {assignedTables.length === 1 && canUnassignSingleTable ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 h-9 w-full border-destructive/30 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onRequestUnassignTable(table.id)}
                aria-label={`Remove table ${table.tableNumber} from booking`}
              >
                <X data-icon="inline-start" aria-hidden />
                Remove Table
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {assignedTables.length > 1 ? (
        <Alert className="border-primary/20 bg-primary/10">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm leading-relaxed text-foreground">
            <strong>Merged tables:</strong> These tables are combined to meet capacity requirements.
            Use &quot;Remove All&quot; to unassign and select fresh tables.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
