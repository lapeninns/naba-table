'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { normalizeTime } from '@reserve/shared/time';

import { useServicePeriods, useUpdateServicePeriods } from '@/hooks/owner/useServicePeriods';
import type { ServicePeriod } from '@/hooks/owner/useServicePeriods';
import { cn } from '@/lib/utils';
import type { ServicePeriodRow, ServicePeriodErrors } from './types';
import { DAY_OPTIONS, BOOKING_OPTION_CHOICES } from './types';

type ServicePeriodsSectionProps = {
  restaurantId: string | null;
};

function mapFromResponse(periods: any[]): ServicePeriodRow[] {
  return periods.map((p) => ({
    id: p.id,
    name: p.name,
    dayOfWeek: p.dayOfWeek,
    startTime: toInputTime(p.startTime),
    endTime: toInputTime(p.endTime),
    bookingOption: p.bookingOption,
  }));
}

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

function coerceServicePeriods(value: unknown): ServicePeriod[] | null {
  if (Array.isArray(value)) {
    return value as ServicePeriod[];
  }
  if (value && typeof value === 'object' && Array.isArray((value as { periods?: unknown }).periods)) {
    return (value as { periods: ServicePeriod[] }).periods;
  }
  return null;
}

export function ServicePeriodsSection({ restaurantId }: ServicePeriodsSectionProps) {
  const { data, error, isLoading } = useServicePeriods(restaurantId);
  const updateMutation = useUpdateServicePeriods(restaurantId);

  const [periodRows, setPeriodRows] = useState<ServicePeriodRow[]>([]);
  const [errors, setErrors] = useState<ServicePeriodErrors>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (data === undefined) {
      return;
    }

    const normalized = coerceServicePeriods(data);

    if (!normalized) {
      console.error('[ServicePeriodsSection] Unexpected service periods payload', data);
      setLoadError('We could not load service periods. Please refresh and try again.');
      setPeriodRows([]);
      setErrors([]);
      setIsDirty(false);
      return;
    }

    setLoadError(null);
    setPeriodRows(mapFromResponse(normalized));
    setErrors([]);
    setIsDirty(false);
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
    setPeriodRows((current) => [
      ...current,
      {
        name: 'New Service',
        dayOfWeek: null,
        startTime: '17:00',
        endTime: '21:00',
        bookingOption: 'dinner',
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

    // Check each period for basic validation
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
      }
      if (!err.startTime && !err.endTime && startComparable && endComparable && startComparable >= endComparable) {
        err.endTime = 'Must be after start';
      }
      if (Object.keys(err).length > 0) {
        newErrors[index] = err;
        valid = false;
      }
    });

    // Check for overlaps on the same day
    const byDay = new Map<number | null, Array<{ start: string | null; end: string | null; index: number }>>();
    periodRows.forEach((row, index) => {
      const key = row.dayOfWeek ?? null;
      const list = byDay.get(key) ?? [];
      list.push({
        start: toComparableTime(row.startTime),
        end: toComparableTime(row.endTime),
        index,
      });
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

    try {
      await updateMutation.mutateAsync(periodRows.map((row) => ({
        id: row.id,
        name: row.name.trim(),
        dayOfWeek: row.dayOfWeek,
        startTime: canonicalizeRequiredTime(row.startTime),
        endTime: canonicalizeRequiredTime(row.endTime),
        bookingOption: row.bookingOption,
      })));
      setIsDirty(false);
      toast.success('Service periods updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update service periods');
    }
  };

  const handleReset = () => {
    if (!data) return;
    setPeriodRows(mapFromResponse(data));
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Unable to load service periods</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Unable to load service periods</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Periods</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isDisabled = updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Periods</CardTitle>
        <CardDescription>Define lunch, dinner, and drinks service times</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Configure meal and bar service windows</p>
          <Button type="button" size="sm" variant="outline" onClick={addPeriod} disabled={isDisabled}>
            <Plus className="mr-1.5 size-4" aria-hidden />
            Add Period
          </Button>
        </div>

        {periodRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service periods defined. Click "Add Period" to create one.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Day</th>
                  <th className="px-4 py-3 text-left">Booking Type</th>
                  <th className="px-4 py-3 text-left">Start</th>
                  <th className="px-4 py-3 text-left">End</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 text-sm">
                {periodRows.map((row, index) => {
                  const err = errors[index] ?? {};
                  return (
                    <tr key={row.id ?? `period-${index}`}>
                      <td className="px-4 py-3">
                        <Input
                          value={row.name}
                          disabled={isDisabled}
                          onChange={(e) => handleChange(index, { name: e.target.value })}
                          aria-invalid={Boolean(err.name)}
                          className={cn('h-9', err.name && 'border-destructive')}
                        />
                        {err.name && <p className="mt-1 text-xs text-destructive">{err.name}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.dayOfWeek ?? ''}
                          disabled={isDisabled}
                          onChange={(e) => handleChange(index, {
                            dayOfWeek: e.target.value === '' ? null : Number(e.target.value),
                          })}
                          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {DAY_OPTIONS.map((opt) => (
                            <option key={opt.label} value={opt.value ?? ''}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.bookingOption}
                          disabled={isDisabled}
                          onChange={(e) => handleChange(index, {
                            bookingOption: e.target.value as ServicePeriodRow['bookingOption'],
                          })}
                          className={cn(
                            'h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            err.bookingOption && 'border-destructive',
                          )}
                          aria-invalid={Boolean(err.bookingOption)}
                        >
                          {BOOKING_OPTION_CHOICES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {err.bookingOption && <p className="mt-1 text-xs text-destructive">{err.bookingOption}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="time"
                          value={row.startTime}
                          disabled={isDisabled}
                          onChange={(e) => handleChange(index, { startTime: e.target.value })}
                          aria-invalid={Boolean(err.startTime)}
                          className={cn('h-9', err.startTime && 'border-destructive')}
                        />
                        {err.startTime && <p className="mt-1 text-xs text-destructive">{err.startTime}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="time"
                          value={row.endTime}
                          disabled={isDisabled}
                          onChange={(e) => handleChange(index, { endTime: e.target.value })}
                          aria-invalid={Boolean(err.endTime)}
                          className={cn('h-9', err.endTime && 'border-destructive')}
                        />
                        {err.endTime && <p className="mt-1 text-xs text-destructive">{err.endTime}</p>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePeriod(index)}
                          disabled={isDisabled}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={handleReset} disabled={!isDirty || isDisabled}>
          Reset
        </Button>
        <Button type="button" onClick={handleSave} disabled={!isDirty || isDisabled}>
          {updateMutation.isPending ? 'Saving…' : 'Save Periods'}
        </Button>
      </CardFooter>
    </Card>
  );
}
