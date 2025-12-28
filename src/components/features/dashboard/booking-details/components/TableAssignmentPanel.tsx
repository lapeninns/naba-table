/**
 * TableAssignmentPanel
 *
 * Table selection UI with filters, warnings, and confirmation.
 */

'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Grid3X3,
  LayoutGrid,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { useTableAssignment } from '../hooks/useTableAssignment';
import { getCapacityFit, groupTablesBySection } from '../utils';
import { SelectableTableCard } from './SelectableTableCard';

export interface TableAssignmentPanelProps {
  bookingId: string;
  restaurantId: string;
  partySize: number;
  currentAssignments: string[];
  onAssignmentComplete: () => void;
}

type FitFilter = 'all' | 'exact' | 'within' | 'oversized' | 'too_small';
type SortOption = 'best' | 'capacity' | 'table';

export function TableAssignmentPanel({
  bookingId,
  restaurantId,
  partySize,
  currentAssignments,
  onAssignmentComplete,
}: TableAssignmentPanelProps) {
  const {
    isLoading,
    error,
    refetch,
    tables,
    suggestedTables,
    selectedTables,
    setSelectedTables,
    selectedCapacity,
    assignedCapacity,
    assignedTableIds,
    conflictedTableIds,
    validation,
    apply,
    unassignAll,
    isPending,
  } = useTableAssignment({
    bookingId,
    restaurantId,
    partySize,
    currentAssignments,
    onAssignmentComplete,
  });

  const [zoneFilter, setZoneFilter] = useState('all');
  const [fitFilter, setFitFilter] = useState<FitFilter>('all');
  const [availabilityOnly, setAvailabilityOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('best');
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (applyError) {
      setApplyError(null);
    }
  }, [selectedTables, assignedTableIds, applyError]);

  const fitById = useMemo(() => {
    const map = new Map<string, FitFilter>();
    tables.forEach((table) => map.set(table.id, getCapacityFit(partySize, table)));
    return map;
  }, [partySize, tables]);

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();
    tables.forEach((table) => zones.add(table.section || 'Main'));
    return ['all', ...Array.from(zones).sort((a, b) => a.localeCompare(b))];
  }, [tables]);

  const filteredTables = useMemo(() => {
    const isAvailable = (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table) return false;
      return table.active && table.status === 'available' && !conflictedTableIds.has(tableId);
    };

    let list = [...tables];

    if (zoneFilter !== 'all') {
      list = list.filter((table) => (table.section || 'Main') === zoneFilter);
    }

    if (availabilityOnly) {
      list = list.filter((table) => isAvailable(table.id));
    }

    if (fitFilter !== 'all') {
      list = list.filter((table) => fitById.get(table.id) === fitFilter);
    }

    if (sortBy === 'capacity') {
      list.sort((a, b) => a.capacity - b.capacity);
    } else if (sortBy === 'table') {
      list.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
    } else {
      list.sort((a, b) => {
        const diffA = Math.abs(a.capacity - partySize);
        const diffB = Math.abs(b.capacity - partySize);
        return diffA - diffB;
      });
    }

    return list;
  }, [availabilityOnly, conflictedTableIds, fitById, fitFilter, partySize, sortBy, tables, zoneFilter]);

  const groupedTables = useMemo(() => groupTablesBySection(filteredTables), [filteredTables]);

  const assignedTables = useMemo(
    () => tables.filter((table) => assignedTableIds.has(table.id)),
    [assignedTableIds, tables],
  );

  const handleApply = () => {
    if (validation.errors.length > 0 || selectedTables.length === 0) return;
    setConfirmApply(true);
  };

  const handleConfirmApply = async () => {
    setConfirmApply(false);
    const result = await apply();
    setApplyError(result.ok ? null : result.error ?? 'Unable to apply tables.');
  };

  const handleUnassign = () => {
    setConfirmUnassign(true);
  };

  const handleConfirmUnassign = async () => {
    setConfirmUnassign(false);
    const result = await unassignAll();
    setApplyError(result.ok ? null : result.error ?? 'Unable to unassign tables.');
  };

  if (isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 space-y-4">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-20 bg-muted/60 rounded-lg" />
            <div className="h-20 bg-muted/60 rounded-lg" />
            <div className="h-20 bg-muted/60 rounded-lg" />
          </div>
          <div className="h-10 bg-muted/60 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load tables</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{error instanceof Error ? error.message : 'Failed to load tables.'}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (tables.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
          <Grid3X3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No tables available right now.</p>
          <p className="text-xs text-muted-foreground">
            Try adjusting the booking time or split the party.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {applyError && (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{applyError}</AlertDescription>
        </Alert>
      )}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Table assignment blocked</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {validation.errors.map((errorText) => (
                <li key={errorText}>{errorText}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert>
          <AlertTitle>Review before assigning</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {validation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>
                <span className="font-semibold">{partySize}</span> covers
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-muted-foreground">
                {selectedCapacity + assignedCapacity} / {partySize} seats
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedTables.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTables([])}
                  disabled={isPending}
                >
                  Clear
                </Button>
              )}
              {assignedTableIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnassign}
                  disabled={isPending}
                  className="text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Unassign
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleApply}
                disabled={isPending || selectedTables.length === 0 || validation.errors.length > 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Apply tables
              </Button>
            </div>
          </div>

          {assignedTables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {assignedTables.map((table) => (
                <Badge key={table.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  Table {table.tableNumber}
                </Badge>
              ))}
            </div>
          )}

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </div>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone === 'all' ? 'All zones' : zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best">Best fit</SelectItem>
                  <SelectItem value="capacity">Capacity</SelectItem>
                  <SelectItem value="table">Table number</SelectItem>
                </SelectContent>
              </Select>
              <ToggleGroup
                type="single"
                value={fitFilter}
                onValueChange={(value) => setFitFilter((value as FitFilter) || 'all')}
                className="flex flex-wrap"
              >
                <ToggleGroupItem value="all" aria-label="All fits">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="exact" aria-label="Exact fit">
                  Exact
                </ToggleGroupItem>
                <ToggleGroupItem value="within" aria-label="Comfort fit">
                  Comfort
                </ToggleGroupItem>
                <ToggleGroupItem value="oversized" aria-label="Large tables">
                  Large
                </ToggleGroupItem>
                <ToggleGroupItem value="too_small" aria-label="Too small">
                  Small
                </ToggleGroupItem>
              </ToggleGroup>
              <div className="flex items-center gap-2 text-xs">
                <Switch checked={availabilityOnly} onCheckedChange={setAvailabilityOnly} />
                <span className="text-muted-foreground">Available only</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {suggestedTables.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
            <LayoutGrid className="h-3.5 w-3.5" />
            Suggested tables
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {suggestedTables.slice(0, 6).map((table) => (
              <SelectableTableCard
                key={table.id}
                table={table}
                partySize={partySize}
                isSelected={selectedTables.includes(table.id)}
                isAssigned={assignedTableIds.has(table.id)}
                isConflicted={conflictedTableIds.has(table.id)}
                onToggle={() =>
                  setSelectedTables((prev) =>
                    prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id],
                  )
                }
                disabled={isPending}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
          <MapPin className="h-3.5 w-3.5" />
          All tables
        </div>
        {filteredTables.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              No tables match the current filters. Try widening the fit or availability filters.
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[320px] pr-2">
            <div className="space-y-4">
              {Array.from(groupedTables.entries()).map(([section, sectionTables]) => (
                <div key={section} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                    {sectionTables.map((table) => (
                      <SelectableTableCard
                        key={table.id}
                        table={table}
                        partySize={partySize}
                        isSelected={selectedTables.includes(table.id)}
                        isAssigned={assignedTableIds.has(table.id)}
                        isConflicted={conflictedTableIds.has(table.id)}
                        onToggle={() =>
                          setSelectedTables((prev) =>
                            prev.includes(table.id) ? prev.filter((id) => id !== table.id) : [...prev, table.id],
                          )
                        }
                        disabled={isPending}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm table assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to assign {selectedTables.length} table
              {selectedTables.length === 1 ? '' : 's'} for {partySize} covers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {validation.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Warnings
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                {validation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmApply} className="bg-emerald-600 hover:bg-emerald-700">
              Confirm assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmUnassign} onOpenChange={setConfirmUnassign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assigned tables?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unassign all current tables for this booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnassign} className="bg-rose-600 hover:bg-rose-700">
              Remove tables
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
