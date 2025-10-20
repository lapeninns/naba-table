'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { normalizeTime } from '@reserve/shared/time';

import { useOpsOccasions, useOpsServicePeriods, useOpsUpdateServicePeriods } from '@/hooks';
import type { ServicePeriodRow, ServicePeriodErrors } from './types';
import { DAY_OPTIONS } from './types';

type ServicePeriodsSectionProps = {
  restaurantId: string | null;
};

function canonicalizeRequiredTime(value: string): string {
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }
  const trimmed = value.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

function toInputTime(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return canonicalizeRequiredTime(value);
}

function toComparableTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = normalizeTime(value);
  if (normalized) {
    return normalized;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function ServicePeriodsSection({ restaurantId }: ServicePeriodsSectionProps) {
  const { data, error, isLoading } = useOpsServicePeriods(restaurantId);
  const updateMutation = useOpsUpdateServicePeriods(restaurantId);
  const occasionQuery = useOpsOccasions();

  const occasionOptions = useMemo(() => occasionQuery.data ?? [], [occasionQuery.data]);
  const occasionKeySet = useMemo(() => new Set(occasionOptions.map((option) => option.key)), [occasionOptions]);
  const defaultOccasionKey = occasionOptions[0]?.key ?? '';

  const [periodRows, setPeriodRows] = useState<ServicePeriodRow[]>([]);
  const [errors, setErrors] = useState<ServicePeriodErrors>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setPeriodRows(
        data.map((period) => ({
          id: period.id,
          name: period.name,
          dayOfWeek: period.dayOfWeek,
          startTime: toInputTime(period.startTime),
          endTime: toInputTime(period.endTime),
          bookingOption: period.bookingOption,
        })),
      );
      setErrors([]);
      setIsDirty(false);
    }
  }, [data]);

  const handleChange = useCallback((index: number, patch: Partial<ServicePeriodRow>) => {
    setPeriodRows((current) => current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
    setIsDirty(true);
    setErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
  }, []);

  const addPeriod = () => {
    const fallbackOption = defaultOccasionKey;
    setPeriodRows((current) => [
      ...current,
      {
        name: 'New Service',
        dayOfWeek: null,
        startTime: '17:00',
        endTime: '21:00',
        bookingOption: fallbackOption,
      },
    ]);
    setErrors((current) => [...current, {}]);
    setIsDirty(true);
  };

  const removePeriod = (index: number) => {
    setPeriodRows((current) => current.filter((_, idx) => idx !== index));
    setErrors((current) => current.filter((_, idx) => idx !== index));
    setIsDirty(true);
  };

  const validate = (): boolean => {
    let valid = true;
    const newErrors: ServicePeriodErrors = periodRows.map(() => ({}));

    periodRows.forEach((row, index) => {
      const err: ServicePeriodErrors[number] = {};
      const startComparable = toComparableTime(row.startTime);
      const endComparable = toComparableTime(row.endTime);

      if (!row.name.trim()) {
        err.name = 'Required';
      }
      if (!row.startTime) {
        err.startTime = 'Required';
      } else if (!startComparable) {
        err.startTime = 'Invalid time';
      }
      if (!row.endTime) {
        err.endTime = 'Required';
      } else if (!endComparable) {
        err.endTime = 'Invalid time';
      }
      if (!row.bookingOption) {
        err.bookingOption = 'Required';
      } else if (!occasionKeySet.has(row.bookingOption)) {
        err.bookingOption = 'Invalid';
      }
      if (!err.startTime && !err.endTime && startComparable && endComparable && startComparable >= endComparable) {
        err.endTime = 'Must be after start';
      }
      if (Object.keys(err).length > 0) {
        newErrors[index] = err;
        valid = false;
      }
    });

    const byDay = new Map<number | null, Array<{ start: string | null; end: string | null; index: number }>>();
    periodRows.forEach((row, index) => {
      const key = row.dayOfWeek ?? null;
      const list = byDay.get(key) ?? [];
      list.push({ start: toComparableTime(row.startTime), end: toComparableTime(row.endTime), index });
      byDay.set(key, list);
    });

    byDay.forEach((list) => {
      const filtered = list.filter((item): item is { start: string; end: string; index: number } => Boolean(item.start && item.end));
      const sorted = [...filtered].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const current = sorted[i];
        if (prev.end > current.start) {
          newErrors[prev.index].endTime = 'Overlaps';
          newErrors[current.index].startTime = 'Overlaps';
          valid = false;
        }
      }
    });

    setErrors(newErrors);
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    const payload = periodRows.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      dayOfWeek: row.dayOfWeek,
      startTime: canonicalizeRequiredTime(row.startTime),
      endTime: canonicalizeRequiredTime(row.endTime),
      bookingOption: row.bookingOption?.trim() ?? '',
    }));

    try {
      await updateMutation.mutateAsync(payload);
      setIsDirty(false);
      toast.success('Service periods updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update service periods');
    }
  };

  const handleReset = () => {
    if (!data) return;
    setPeriodRows(
      data.map((period) => ({
        id: period.id,
        name: period.name,
        dayOfWeek: period.dayOfWeek,
        startTime: toInputTime(period.startTime),
        endTime: toInputTime(period.endTime),
        bookingOption: period.bookingOption,
      })),
    );
    setErrors([]);
    setIsDirty(false);
  };

  if (!restaurantId) {
    return (
      <Card>
        <CardContent className="flex min-h-[200px] items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Select a restaurant to manage service periods</p>
        </CardContent>
      </Card>
    );
  }

  const loadError = error ?? (occasionQuery.error ?? null);

  if (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Unable to load service periods';
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Unable to load service periods</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isCatalogueLoading = occasionQuery.isLoading && occasionOptions.length === 0;
  if ((isLoading && !data) || isCatalogueLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isDisabled = updateMutation.isPending;
  const disableOccasionSelect = occasionQuery.isLoading || occasionOptions.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Periods</CardTitle>
        <CardDescription>Define named service windows for booking allocation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {periodRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No service periods configured yet.</p>
            <Button
              type="button"
              variant="outline"
              onClick={addPeriod}
              disabled={isDisabled || occasionOptions.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden /> Add service period
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {periodRows.map((row, index) => {
              const err = errors[index] ?? {};
              return (
                <div key={row.id ?? index} className="grid gap-3 rounded-lg border border-border/60 p-4 text-sm md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
                    <Input
                      value={row.name}
                      disabled={isDisabled}
                      onChange={(event) => handleChange(index, { name: event.target.value })}
                      className={cn('mt-1 h-9', err.name && 'border-destructive')}
                    />
                    {err.name && <p className="mt-1 text-xs text-destructive">{err.name}</p>}
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Day</Label>
                    <select
                      value={row.dayOfWeek ?? ''}
                      onChange={(event) =>
                        handleChange(index, {
                          dayOfWeek: event.target.value === '' ? null : Number.parseInt(event.target.value, 10),
                        })
                      }
                      disabled={isDisabled}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {DAY_OPTIONS.map((option) => (
                        <option key={option.value ?? 'all'} value={option.value ?? ''}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Start</Label>
                    <Input
                      type="time"
                      value={row.startTime}
                      disabled={isDisabled}
                      onChange={(event) => handleChange(index, { startTime: event.target.value })}
                      className={cn('mt-1 h-9', err.startTime && 'border-destructive')}
                    />
                    {err.startTime && <p className="mt-1 text-xs text-destructive">{err.startTime}</p>}
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">End</Label>
                    <Input
                      type="time"
                      value={row.endTime}
                      disabled={isDisabled}
                      onChange={(event) => handleChange(index, { endTime: event.target.value })}
                      className={cn('mt-1 h-9', err.endTime && 'border-destructive')}
                    />
                    {err.endTime && <p className="mt-1 text-xs text-destructive">{err.endTime}</p>}
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Occasion</Label>
                    <select
                      value={row.bookingOption ?? ''}
                      onChange={(event) => handleChange(index, { bookingOption: event.target.value as ServicePeriodRow['bookingOption'] })}
                      disabled={isDisabled || disableOccasionSelect}
                      className={cn('mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', err.bookingOption && 'border-destructive')}
                    >
                      {occasionOptions.length === 0 ? (
                        <option value="">No occasions configured</option>
                      ) : (
                        occasionOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.shortLabel ?? option.label}
                          </option>
                        ))
                      )}
                    </select>
                    {err.bookingOption && <p className="mt-1 text-xs text-destructive">{err.bookingOption}</p>}
                    {occasionOptions.length === 0 && !occasionQuery.isLoading ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure booking occasions in Ops to populate this list.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(index)} disabled={isDisabled}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Remove service period</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border/60 bg-muted/40 px-6 py-4">
        <div className="text-xs text-muted-foreground">Align service periods with kitchen and front-of-house workflows.</div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleReset} disabled={isDisabled || !isDirty}>
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={isDisabled || !isDirty}>
            Save changes
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
