/**
 * TableAssignmentPanel
 *
 * Table selection UI with filters, warnings, and confirmation.
 */

'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Grid3X3,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { useTableAssignment } from '../hooks/useTableAssignment';
import { getCapacityFit, groupTablesBySection } from '../utils';
import { SelectableTableCard } from './SelectableTableCard';

export interface TableAssignmentPanelProps {
  bookingId: string;
  restaurantId: string;
  partySize: number;
  date: string | null;
  currentAssignments: string[];
  onAssignmentComplete: () => void;
  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
}

type FitFilter = 'all' | 'perfect' | 'exact' | 'within' | 'oversized' | 'too_small';
type SortOption = 'best' | 'capacity' | 'table';

export function TableAssignmentPanel({
  bookingId,
  restaurantId,
  partySize,
  date,
  currentAssignments,
  onAssignmentComplete,
  bookingStartTime,
  bookingEndTime,
}: TableAssignmentPanelProps) {
  const {
    context,
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
    autoAssign,
    isPending,
  } = useTableAssignment({
    bookingId,
    restaurantId,
    partySize,
    date,
    currentAssignments,
    onAssignmentComplete,
  });

  const parsedTimes = useMemo(() => {
    const parse = (value?: string | null) => {
      if (!value) return null;
      const timePart = value.includes('T') ? value.split('T')[1] : value;
      const match = timePart.match(/(\d{2}):(\d{2})/);
      if (!match) return null;
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
      return hours * 60 + minutes;
    };

    const timelineBookingStart = bookingStartTime ?? context?.booking.start_time ?? null;
    const timelineBookingEnd = bookingEndTime ?? null;
    const timelineWindowStart = context?.window?.startAt ?? null;
    const timelineWindowEnd = context?.window?.endAt ?? null;

    return {
      bookingStart: timelineBookingStart,
      bookingEnd: timelineBookingEnd,
      windowStart: timelineWindowStart,
      windowEnd: timelineWindowEnd,
      parsedBookingStart: parse(timelineBookingStart),
      parsedBookingEnd: parse(timelineBookingEnd),
      parsedWindowStart: parse(timelineWindowStart),
      parsedWindowEnd: parse(timelineWindowEnd),
    };
  }, [
    bookingStartTime,
    bookingEndTime,
    context?.booking.start_time,
    context?.window?.startAt,
    context?.window?.endAt,
  ]);

  const [zoneFilter, setZoneFilter] = useState('all');
  const [fitFilter, setFitFilter] = useState<FitFilter>('all');
  const [availabilityOnly, setAvailabilityOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('best');
  const [confirmApply, setConfirmApply] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [smartAssignError, setSmartAssignError] = useState<string | null>(null);
  const selectedTableIds = useMemo(() => new Set(selectedTables), [selectedTables]);

  useEffect(() => {
    if (applyError) setApplyError(null);
    if (smartAssignError) setSmartAssignError(null);
  }, [selectedTables, assignedTableIds, applyError, smartAssignError]);

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
    let list = tables;

    if (zoneFilter !== 'all') {
      list = list.filter((table) => (table.section || 'Main') === zoneFilter);
    }

    if (availabilityOnly) {
      list = list.filter(
        (table) =>
          table.active && table.status === 'available' && !conflictedTableIds.has(table.id),
      );
    }

    if (fitFilter === 'perfect') {
      list = list.filter(
        (table) => table.capacity === partySize || table.capacity === partySize + 1,
      );
    } else if (fitFilter !== 'all') {
      list = list.filter((table) => fitById.get(table.id) === fitFilter);
    }

    const result = [...list];

    if (sortBy === 'capacity') {
      result.sort((a, b) => a.capacity - b.capacity);
    } else if (sortBy === 'table') {
      result.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
    } else {
      result.sort((a, b) => {
        const diffA = Math.abs(a.capacity - partySize);
        const diffB = Math.abs(b.capacity - partySize);
        return diffA - diffB;
      });
    }

    return result;
  }, [
    availabilityOnly,
    conflictedTableIds,
    fitById,
    fitFilter,
    partySize,
    sortBy,
    tables,
    zoneFilter,
  ]);

  const groupedTables = useMemo(() => groupTablesBySection(filteredTables), [filteredTables]);

  const assignedTables = useMemo(
    () => tables.filter((table) => assignedTableIds.has(table.id)),
    [assignedTableIds, tables],
  );

  const handleApply = () => {
    if (validation.errors.length > 0 || selectedTables.length === 0) return;
    setConfirmApply(true);
  };

  const handleToggleTable = useCallback(
    (tableId: string) => {
      setSelectedTables((prev) =>
        prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
      );
    },
    [setSelectedTables],
  );

  const handleSmartAssign = async () => {
    if (assignedTableIds.size > 0) {
      setSmartAssignError('Remove current table assignments before using smart assign.');
      return;
    }

    setSmartAssignError(null);
    const result = await autoAssign();

    if (!result.ok) {
      setSmartAssignError(result.error ?? 'Smart assign failed.');
    }
  };

  const handleConfirmApply = async () => {
    setConfirmApply(false);
    const result = await apply();
    setApplyError(result.ok ? null : (result.error ?? 'Unable to apply tables.'));
  };

  const handleUnassign = () => {
    setConfirmUnassign(true);
  };

  const handleConfirmUnassign = async () => {
    setConfirmUnassign(false);
    const result = await unassignAll();
    setApplyError(result.ok ? null : (result.error ?? 'Unable to unassign tables.'));
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
      {smartAssignError && (
        <Alert>
          <AlertTitle>Smart assign unavailable</AlertTitle>
          <AlertDescription>{smartAssignError}</AlertDescription>
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

      <Card className="bg-slate-50/50 border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-3 sm:p-4">
          {/* Capacity Summary Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center shadow-sm',
                    selectedCapacity + assignedCapacity >= partySize
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-amber-100 text-amber-600',
                  )}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900 leading-none mb-1">
                    {partySize} Covers
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {selectedCapacity + assignedCapacity >= partySize
                      ? 'Capacity Met'
                      : `Need ${partySize - selectedCapacity - assignedCapacity} more`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900 leading-none">
                  {selectedCapacity + assignedCapacity}
                  <span className="text-sm font-medium text-slate-400">/{partySize}</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                  Seated
                </div>
              </div>
            </div>
            <Progress
              value={Math.min(((selectedCapacity + assignedCapacity) / partySize) * 100, 100)}
              className={cn(
                'h-2.5 bg-slate-200',
                selectedCapacity + assignedCapacity >= partySize
                  ? '[&>div]:bg-emerald-500'
                  : '[&>div]:bg-amber-500',
              )}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSmartAssign}
                disabled={isPending || tables.length === 0}
                className="gap-1.5 h-8 bg-white border-slate-200 text-xs font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Smart Assign
              </Button>
              {selectedTables.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTables([])}
                  disabled={isPending}
                  className="h-8 text-xs hover:bg-slate-100"
                >
                  Clear
                </Button>
              )}
              {assignedTableIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUnassign}
                  disabled={isPending}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              )}
            </div>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isPending || selectedTables.length === 0 || validation.errors.length > 0}
              className="bg-emerald-600 hover:bg-emerald-700 h-9 font-bold shadow-sm"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Assignment
            </Button>
          </div>

          {/* Currently Assigned Tables */}
          {assignedTables.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Currently Assigned
              </div>
              <div className="flex flex-wrap gap-2">
                {assignedTables.map((table) => (
                  <Badge
                    key={table.id}
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    Table {table.tableNumber} · {table.capacity} seats
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-slate-200/50">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-2">
                <Filter className="h-3 w-3" />
                Filters
              </div>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="h-7 w-[130px] text-xs bg-white">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  {zoneOptions.map((zone) => (
                    <SelectItem key={zone} value={zone} className="text-xs">
                      {zone === 'all' ? 'All zones' : zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="h-7 w-[120px] text-xs bg-white">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="best" className="text-xs">
                    Best fit
                  </SelectItem>
                  <SelectItem value="capacity" className="text-xs">
                    Capacity
                  </SelectItem>
                  <SelectItem value="table" className="text-xs">
                    Table number
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 h-7">
                <Switch
                  id="avail-only"
                  checked={availabilityOnly}
                  onCheckedChange={setAvailabilityOnly}
                  className="scale-75 origin-left"
                />
                <label
                  htmlFor="avail-only"
                  className="text-xs font-medium text-slate-600 cursor-pointer select-none"
                >
                  Available
                </label>
              </div>
            </div>

            <div className="flex overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              <div className="flex gap-1">
                {[
                  {
                    value: 'all',
                    label: 'All Fits',
                    activeClass: 'bg-slate-800 hover:bg-slate-900',
                  },
                  {
                    value: 'perfect',
                    label: 'Perfect',
                    activeClass: 'bg-emerald-600 hover:bg-emerald-700',
                  },
                  {
                    value: 'exact',
                    label: 'Exact',
                    activeClass: 'bg-emerald-600 hover:bg-emerald-700',
                  },
                  {
                    value: 'within',
                    label: 'Comfort',
                    activeClass: 'bg-blue-600 hover:bg-blue-700',
                  },
                  {
                    value: 'oversized',
                    label: 'Large',
                    activeClass: 'bg-amber-600 hover:bg-amber-700',
                  },
                  {
                    value: 'too_small',
                    label: 'Small',
                    activeClass: 'bg-rose-600 hover:bg-rose-700',
                  },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    variant={fitFilter === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFitFilter(opt.value as FitFilter)}
                    className={cn(
                      'h-6 text-[10px] px-2 rounded-md border-slate-200',
                      fitFilter === opt.value
                        ? cn('text-white border-transparent', opt.activeClass)
                        : 'text-slate-600 bg-white hover:bg-slate-50',
                    )}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {suggestedTables.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-indigo-50 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Suggested Tables
              </span>
            </div>
            <Badge
              variant="secondary"
              className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 px-1.5 py-0"
            >
              AI Optimized
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {suggestedTables.slice(0, 6).map((table, index) => {
              const fit = getCapacityFit(partySize, table);
              const recommendationLabel =
                index === 0
                  ? 'Best Match'
                  : fit === 'exact'
                    ? 'Exact Fit'
                    : fit === 'within'
                      ? 'Good Fit'
                      : null;
              const isTableConflicted =
                conflictedTableIds.has(table.id) || table.status === 'conflicted';

              return (
                <div key={table.id} className="relative">
                  {recommendationLabel && (
                    <div
                      className={cn(
                        'absolute -top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                        index === 0
                          ? 'bg-amber-500 text-white'
                          : fit === 'exact'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-blue-500 text-white',
                      )}
                    >
                      {recommendationLabel}
                    </div>
                  )}
                  <SelectableTableCard
                    tableId={table.id}
                    table={table}
                    partySize={partySize}
                    isSelected={selectedTableIds.has(table.id)}
                    isAssigned={assignedTableIds.has(table.id)}
                    isConflicted={isTableConflicted}
                    onToggle={handleToggleTable}
                    disabled={isPending}
                    bookingStartTime={parsedTimes.bookingStart}
                    bookingEndTime={parsedTimes.bookingEnd}
                    serviceWindowStart={parsedTimes.windowStart}
                    serviceWindowEnd={parsedTimes.windowEnd}
                    parsedBookingStart={parsedTimes.parsedBookingStart}
                    parsedBookingEnd={parsedTimes.parsedBookingEnd}
                    parsedServiceStart={parsedTimes.parsedWindowStart}
                    parsedServiceEnd={parsedTimes.parsedWindowEnd}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-900">All Tables</span>
          </div>
          <span className="text-xs text-muted-foreground">{filteredTables.length} tables</span>
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
              {Array.from(groupedTables.entries()).map(([section, sectionTables], zoneIndex) => {
                const zoneColors = [
                  'bg-blue-500',
                  'bg-purple-500',
                  'bg-teal-500',
                  'bg-rose-500',
                  'bg-orange-500',
                  'bg-cyan-500',
                ];
                const zoneColor = zoneColors[zoneIndex % zoneColors.length];

                const conflictedInZone = sectionTables.filter((t) => conflictedTableIds.has(t.id));

                return (
                  <div key={section} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2.5 h-2.5 rounded-full', zoneColor)} />
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {section}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({sectionTables.length} tables)
                        </span>
                      </div>
                      {conflictedInZone.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {conflictedInZone.length} conflict{conflictedInZone.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                      {sectionTables.map((table) => {
                        const isTableConflicted =
                          conflictedTableIds.has(table.id) || table.status === 'conflicted';
                        return (
                          <SelectableTableCard
                            key={table.id}
                            tableId={table.id}
                            table={table}
                            partySize={partySize}
                            isSelected={selectedTableIds.has(table.id)}
                            isAssigned={assignedTableIds.has(table.id)}
                            isConflicted={isTableConflicted}
                            onToggle={handleToggleTable}
                            disabled={isPending}
                            bookingStartTime={parsedTimes.bookingStart}
                            bookingEndTime={parsedTimes.bookingEnd}
                            serviceWindowStart={parsedTimes.windowStart}
                            serviceWindowEnd={parsedTimes.windowEnd}
                            parsedBookingStart={parsedTimes.parsedBookingStart}
                            parsedBookingEnd={parsedTimes.parsedBookingEnd}
                            parsedServiceStart={parsedTimes.parsedWindowStart}
                            parsedServiceEnd={parsedTimes.parsedWindowEnd}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
            <AlertDialogAction
              onClick={handleConfirmApply}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
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
            <AlertDialogAction
              onClick={handleConfirmUnassign}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Remove tables
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
