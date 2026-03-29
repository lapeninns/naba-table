'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { HelpTooltip } from '@/components/features/restaurant-settings/HelpTooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useOpsOperatingHours, useOpsUpdateOperatingHours } from '@/hooks/ops/useOpsOperatingHours';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import { cn } from '@/lib/utils';
import { normalizeTime } from '@reserve/shared/time';

import { OperatingHoursOverrideDateField } from './OperatingHoursOverrideDateField';
import { SettingsCard, SettingsSectionHeader } from './shared';
import { DAYS_OF_WEEK } from './types';

import type { OverrideErrors, OverrideRow, WeeklyErrors, WeeklyRow } from './types';
import type { OperatingHoursSnapshot } from '@/services/ops/restaurants';

type OperatingHoursSectionProps = {
  restaurantId: string | null;
};

function mapWeeklyFromResponse(snapshot: OperatingHoursSnapshot['weekly']): WeeklyRow[] {
  return DAYS_OF_WEEK.map((_, index) => {
    const found = snapshot.find((row) => row.dayOfWeek === index);
    return {
      dayOfWeek: index,
      opensAt: toInputTime(found?.opensAt ?? null),
      closesAt: toInputTime(found?.closesAt ?? null),
      isClosed: found?.isClosed ?? true,
      notes: found?.notes ?? '',
      reservationIntervalMinutes:
        found?.reservationIntervalMinutes !== undefined &&
        found?.reservationIntervalMinutes !== null
          ? String(found.reservationIntervalMinutes)
          : '',
      reservationSlotTimes: Array.isArray(found?.reservationSlotTimes)
        ? found.reservationSlotTimes.join(', ')
        : '',
    };
  });
}

function mapOverridesFromResponse(overrides: OperatingHoursSnapshot['overrides']): OverrideRow[] {
  return overrides.map((row) => ({
    id: row.id,
    effectiveDate: row.effectiveDate,
    opensAt: toInputTime(row.opensAt ?? null),
    closesAt: toInputTime(row.closesAt ?? null),
    isClosed: row.isClosed,
    notes: row.notes ?? '',
    reservationIntervalMinutes:
      row.reservationIntervalMinutes !== undefined && row.reservationIntervalMinutes !== null
        ? String(row.reservationIntervalMinutes)
        : '',
    reservationSlotTimes: Array.isArray(row.reservationSlotTimes)
      ? row.reservationSlotTimes.join(', ')
      : '',
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

function parseIntervalInput(value: string): { value: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return { value: null, error: 'Must be a whole number' };
  }
  if (parsed < RESERVATION_INTERVAL_MIN || parsed > RESERVATION_INTERVAL_MAX) {
    return {
      value: null,
      error: `Must be between ${RESERVATION_INTERVAL_MIN}-${RESERVATION_INTERVAL_MAX}`,
    };
  }
  return { value: parsed };
}

function parseSlotTimesInput(value: string): { value: string[] | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }
  const parts = trimmed
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { value: null };
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const time = normalizeTime(part);
    if (!time) {
      return { value: null, error: 'Use HH:MM format (e.g., 16:00)' };
    }
    if (!seen.has(time)) {
      seen.add(time);
      normalized.push(time);
    }
  }
  return { value: normalized };
}

export function OperatingHoursSection({ restaurantId }: OperatingHoursSectionProps) {
  const { data, error, isLoading } = useOpsOperatingHours(restaurantId);
  const updateMutation = useOpsUpdateOperatingHours(restaurantId);

  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>(
    DAYS_OF_WEEK.map((_, i) => ({
      dayOfWeek: i,
      opensAt: '',
      closesAt: '',
      isClosed: true,
      notes: '',
      reservationIntervalMinutes: '',
      reservationSlotTimes: '',
    })),
  );
  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);
  const [weeklyErrors, setWeeklyErrors] = useState<WeeklyErrors>({});
  const [overrideErrors, setOverrideErrors] = useState<OverrideErrors>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setWeeklyRows(mapWeeklyFromResponse(data.weekly));
      setOverrideRows(mapOverridesFromResponse(data.overrides));
      setWeeklyErrors({});
      setOverrideErrors([]);
      setIsDirty(false);
    }
  }, [data]);

  const handleWeeklyChange = useCallback((index: number, patch: Partial<WeeklyRow>) => {
    setWeeklyRows((current) =>
      current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
    setIsDirty(true);
    setWeeklyErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const handleOverrideChange = useCallback((index: number, patch: Partial<OverrideRow>) => {
    setOverrideRows((current) =>
      current.map((row, idx) => (idx === index ? { ...row, ...patch } : row)),
    );
    setIsDirty(true);
    setOverrideErrors((prev) => {
      const next = [...prev];
      next[index] = {};
      return next;
    });
  }, []);

  const addOverride = () => {
    const today = new Date().toISOString().slice(0, 10);
    setOverrideRows((current) => [
      ...current,
      {
        effectiveDate: today,
        opensAt: '',
        closesAt: '',
        isClosed: true,
        notes: '',
        reservationIntervalMinutes: '',
        reservationSlotTimes: '',
      },
    ]);
    setOverrideErrors((current) => [...current, {}]);
    setIsDirty(true);
  };

  const removeOverride = (index: number) => {
    setOverrideRows((current) => current.filter((_, idx) => idx !== index));
    setOverrideErrors((current) => current.filter((_, idx) => idx !== index));
    setIsDirty(true);
  };

  const validate = (): boolean => {
    let valid = true;
    const wErrors: WeeklyErrors = {};

    weeklyRows.forEach((row) => {
      if (row.isClosed) return;
      const errors: WeeklyErrors[number] = {};
      const openComparable = toComparableTime(row.opensAt);
      const closeComparable = toComparableTime(row.closesAt);
      const intervalResult = parseIntervalInput(row.reservationIntervalMinutes);
      const slotResult = parseSlotTimesInput(row.reservationSlotTimes);

      if (!row.opensAt) {
        errors.opensAt = 'Required';
      } else if (!openComparable) {
        errors.opensAt = 'Invalid time';
      }

      if (!row.closesAt) {
        errors.closesAt = 'Required';
      } else if (!closeComparable) {
        errors.closesAt = 'Invalid time';
      }

      if (
        !errors.opensAt &&
        !errors.closesAt &&
        openComparable &&
        closeComparable &&
        openComparable >= closeComparable
      ) {
        errors.closesAt = 'Must be after open';
      }

      if (intervalResult.error) {
        errors.reservationIntervalMinutes = intervalResult.error;
      }
      if (slotResult.error) {
        errors.reservationSlotTimes = slotResult.error;
      }

      if (Object.keys(errors).length > 0) {
        wErrors[row.dayOfWeek] = errors;
        valid = false;
      }
    });

    const oErrors: OverrideErrors = overrideRows.map(() => ({}));
    const seenDates = new Map<string, number>();

    overrideRows.forEach((row, index) => {
      const errors: OverrideErrors[number] = {};
      const intervalResult = parseIntervalInput(row.reservationIntervalMinutes);
      const slotResult = parseSlotTimesInput(row.reservationSlotTimes);
      if (!row.effectiveDate) {
        errors.effectiveDate = 'Required';
      } else if (seenDates.has(row.effectiveDate)) {
        errors.effectiveDate = 'Duplicate date';
        const dupIdx = seenDates.get(row.effectiveDate)!;
        oErrors[dupIdx].effectiveDate = 'Duplicate date';
      } else {
        seenDates.set(row.effectiveDate, index);
      }

      if (!row.isClosed) {
        const openComparable = toComparableTime(row.opensAt);
        const closeComparable = toComparableTime(row.closesAt);

        if (!row.opensAt) {
          errors.opensAt = 'Required';
        } else if (!openComparable) {
          errors.opensAt = 'Invalid time';
        }

        if (!row.closesAt) {
          errors.closesAt = 'Required';
        } else if (!closeComparable) {
          errors.closesAt = 'Invalid time';
        }

        if (
          !errors.opensAt &&
          !errors.closesAt &&
          openComparable &&
          closeComparable &&
          openComparable >= closeComparable
        ) {
          errors.closesAt = 'Must be after open';
        }
      }

      if (intervalResult.error) {
        errors.reservationIntervalMinutes = intervalResult.error;
      }
      if (slotResult.error) {
        errors.reservationSlotTimes = slotResult.error;
      }

      if (Object.keys(errors).length > 0) {
        oErrors[index] = errors;
        valid = false;
      }
    });

    setWeeklyErrors(wErrors);
    setOverrideErrors(oErrors);
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    const payload: OperatingHoursSnapshot = {
      weekly: weeklyRows.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        opensAt: row.isClosed ? null : row.opensAt ? canonicalizeRequiredTime(row.opensAt) : null,
        closesAt: row.isClosed
          ? null
          : row.closesAt
            ? canonicalizeRequiredTime(row.closesAt)
            : null,
        isClosed: row.isClosed,
        notes: row.notes || null,
        reservationIntervalMinutes: row.isClosed
          ? null
          : parseIntervalInput(row.reservationIntervalMinutes).value,
        reservationSlotTimes: row.isClosed
          ? null
          : parseSlotTimesInput(row.reservationSlotTimes).value,
      })),
      overrides: overrideRows.map((row) => ({
        id: row.id,
        effectiveDate: row.effectiveDate,
        opensAt: row.isClosed ? null : row.opensAt ? canonicalizeRequiredTime(row.opensAt) : null,
        closesAt: row.isClosed
          ? null
          : row.closesAt
            ? canonicalizeRequiredTime(row.closesAt)
            : null,
        isClosed: row.isClosed,
        notes: row.notes || null,
        reservationIntervalMinutes: row.isClosed
          ? null
          : parseIntervalInput(row.reservationIntervalMinutes).value,
        reservationSlotTimes: row.isClosed
          ? null
          : parseSlotTimesInput(row.reservationSlotTimes).value,
      })),
    };

    try {
      await updateMutation.mutateAsync(payload);
      setIsDirty(false);
    } catch (error) {
      console.error('[operating-hours] save failed', error);
    }
  };

  const handleReset = () => {
    if (!data) return;
    setWeeklyRows(mapWeeklyFromResponse(data.weekly));
    setOverrideRows(mapOverridesFromResponse(data.overrides));
    setWeeklyErrors({});
    setOverrideErrors([]);
    setIsDirty(false);
  };

  const isDisabled = updateMutation.isPending;

  useGlobalShortcuts([
    {
      key: 's',
      metaOrCtrl: true,
      preventDefault: true,
      enabled: !isDisabled && isDirty,
      when: () => true,
      handler: () => {
        if (!isDisabled && isDirty) {
          void handleSave();
        }
      },
    },
  ]);

  if (!restaurantId) {
    return (
      <SettingsCard title="Operating Hours">
        <div className="flex min-h-[200px] items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            Select a restaurant to manage operating hours
          </p>
        </div>
      </SettingsCard>
    );
  }

  if (error) {
    return (
      <SettingsCard title="Operating Hours">
        <Alert variant="destructive">
          <AlertTitle>Unable to load operating hours</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </SettingsCard>
    );
  }

  if (isLoading && !data) {
    return (
      <SettingsCard title="Operating Hours" description="Loading…">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </SettingsCard>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <SettingsCard
        title="Operating Hours"
        description="Configure weekly schedule and holiday overrides"
        footer={
          <div className="flex w-full items-center justify-between">
            <div className="text-xs text-muted-foreground hidden sm:block">
              Changes are saved per restaurant. Remember to keep staff informed about special hours.
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isDisabled || !isDirty}
              >
                Reset
              </Button>
              <Button type="button" onClick={handleSave} disabled={isDisabled || !isDirty}>
                Save changes
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-8">
          {/* Weekly Schedule */}
          <div className="space-y-3">
            <SettingsSectionHeader
              title="Weekly Schedule"
              description="Set default open/close windows for each day. Mark a day closed to block bookings."
            />
            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left">Day</th>
                      <th className="px-4 py-3 text-left">Open</th>
                      <th className="px-4 py-3 text-left">Close</th>
                      <th className="px-4 py-3 text-left">Interval (min)</th>
                      <th className="px-4 py-3 text-left">Slots (HH:MM)</th>
                      <th className="px-4 py-3 text-left">Closed</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70 text-sm">
                    {weeklyRows.map((row, index) => {
                      const errors = weeklyErrors[row.dayOfWeek] ?? {};
                      return (
                        <tr key={row.dayOfWeek} className={cn(row.isClosed && 'bg-muted/40')}>
                          <th
                            scope="row"
                            className="px-4 py-3 font-medium text-foreground whitespace-nowrap"
                          >
                            {DAYS_OF_WEEK[row.dayOfWeek]}
                          </th>
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={row.opensAt}
                              disabled={isDisabled || row.isClosed}
                              onChange={(event) =>
                                handleWeeklyChange(index, { opensAt: event.target.value })
                              }
                              aria-invalid={Boolean(errors.opensAt)}
                              className={cn(
                                'h-9 min-w-[100px]',
                                errors.opensAt && 'border-destructive',
                              )}
                            />
                            {errors.opensAt && (
                              <p className="mt-1 text-xs text-destructive">{errors.opensAt}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="time"
                              value={row.closesAt}
                              disabled={isDisabled || row.isClosed}
                              onChange={(event) =>
                                handleWeeklyChange(index, { closesAt: event.target.value })
                              }
                              aria-invalid={Boolean(errors.closesAt)}
                              className={cn(
                                'h-9 min-w-[100px]',
                                errors.closesAt && 'border-destructive',
                              )}
                            />
                            {errors.closesAt && (
                              <p className="mt-1 text-xs text-destructive">{errors.closesAt}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={RESERVATION_INTERVAL_MIN}
                              max={RESERVATION_INTERVAL_MAX}
                              step={1}
                              value={row.reservationIntervalMinutes}
                              disabled={isDisabled || row.isClosed}
                              onChange={(event) =>
                                handleWeeklyChange(index, {
                                  reservationIntervalMinutes: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(errors.reservationIntervalMinutes)}
                              className={cn(
                                'h-9 min-w-[120px]',
                                errors.reservationIntervalMinutes && 'border-destructive',
                              )}
                              placeholder="Default"
                            />
                            {errors.reservationIntervalMinutes && (
                              <p className="mt-1 text-xs text-destructive">
                                {errors.reservationIntervalMinutes}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={row.reservationSlotTimes}
                              placeholder="16:00, 18:00, 20:00"
                              disabled={isDisabled || row.isClosed}
                              onChange={(event) =>
                                handleWeeklyChange(index, {
                                  reservationSlotTimes: event.target.value,
                                })
                              }
                              aria-invalid={Boolean(errors.reservationSlotTimes)}
                              className={cn(
                                'h-9 min-w-[180px]',
                                errors.reservationSlotTimes && 'border-destructive',
                              )}
                            />
                            {errors.reservationSlotTimes && (
                              <p className="mt-1 text-xs text-destructive">
                                {errors.reservationSlotTimes}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              <input
                                id={`weekly-${row.dayOfWeek}-closed`}
                                type="checkbox"
                                checked={row.isClosed}
                                disabled={isDisabled}
                                onChange={(event) =>
                                  handleWeeklyChange(index, {
                                    isClosed: event.target.checked,
                                    opensAt: event.target.checked ? '' : row.opensAt || '09:00',
                                    closesAt: event.target.checked ? '' : row.closesAt || '18:00',
                                  })
                                }
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <Label htmlFor={`weekly-${row.dayOfWeek}-closed`} className="sr-only">
                                Closed all day
                              </Label>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              value={row.notes}
                              placeholder="Optional"
                              disabled={isDisabled}
                              onChange={(event) =>
                                handleWeeklyChange(index, { notes: event.target.value })
                              }
                              className="h-9 min-w-[150px]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Overrides */}
          <div className="space-y-3">
            <SettingsSectionHeader
              title="Overrides"
              description="Create one-off changes for holidays or events. Overrides apply on their date only."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOverride}
                  disabled={isDisabled}
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden /> Add override
                </Button>
              }
            />

            {overrideRows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No overrides configured. Use overrides to adjust hours for special events or
                  holidays.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {overrideRows.map((row, index) => {
                  const errors = overrideErrors[index] ?? {};
                  return (
                    <div
                      key={row.id ?? index}
                      className="grid gap-3 rounded-lg border border-border/60 p-4 text-sm md:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
                    >
                      <div>
                        <OperatingHoursOverrideDateField
                          value={row.effectiveDate}
                          onChange={(value) =>
                            handleOverrideChange(index, { effectiveDate: value })
                          }
                          disabled={isDisabled}
                          error={errors.effectiveDate}
                        />
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Open
                        </Label>
                        <Input
                          type="time"
                          value={row.opensAt}
                          disabled={isDisabled || row.isClosed}
                          onChange={(event) =>
                            handleOverrideChange(index, { opensAt: event.target.value })
                          }
                          className={cn('mt-1 h-9', errors.opensAt && 'border-destructive')}
                        />
                        {errors.opensAt && (
                          <p className="mt-1 text-xs text-destructive">{errors.opensAt}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Close
                        </Label>
                        <Input
                          type="time"
                          value={row.closesAt}
                          disabled={isDisabled || row.isClosed}
                          onChange={(event) =>
                            handleOverrideChange(index, { closesAt: event.target.value })
                          }
                          className={cn('mt-1 h-9', errors.closesAt && 'border-destructive')}
                        />
                        {errors.closesAt && (
                          <p className="mt-1 text-xs text-destructive">{errors.closesAt}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Interval (min)
                        </Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={RESERVATION_INTERVAL_MIN}
                          max={RESERVATION_INTERVAL_MAX}
                          step={1}
                          value={row.reservationIntervalMinutes}
                          disabled={isDisabled || row.isClosed}
                          onChange={(event) =>
                            handleOverrideChange(index, {
                              reservationIntervalMinutes: event.target.value,
                            })
                          }
                          className={cn(
                            'mt-1 h-9',
                            errors.reservationIntervalMinutes && 'border-destructive',
                          )}
                          placeholder="Default"
                        />
                        {errors.reservationIntervalMinutes && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.reservationIntervalMinutes}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Slots (HH:MM)
                        </Label>
                        <Input
                          value={row.reservationSlotTimes}
                          placeholder="16:00, 18:00, 20:00"
                          disabled={isDisabled || row.isClosed}
                          onChange={(event) =>
                            handleOverrideChange(index, {
                              reservationSlotTimes: event.target.value,
                            })
                          }
                          className={cn(
                            'mt-1 h-9',
                            errors.reservationSlotTimes && 'border-destructive',
                          )}
                        />
                        {errors.reservationSlotTimes && (
                          <p className="mt-1 text-xs text-destructive">
                            {errors.reservationSlotTimes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col justify-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Closed
                          </Label>
                          <HelpTooltip
                            description="Enable to close the restaurant for the entire override date. Leave off to set custom hours."
                            ariaLabel="Override closed help"
                            align="center"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id={`override-${index}-closed`}
                            type="checkbox"
                            checked={row.isClosed}
                            disabled={isDisabled}
                            onChange={(event) =>
                              handleOverrideChange(index, {
                                isClosed: event.target.checked,
                                opensAt: event.target.checked ? '' : row.opensAt || '09:00',
                                closesAt: event.target.checked ? '' : row.closesAt || '18:00',
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <Label htmlFor={`override-${index}-closed`} className="text-sm">
                            Closed all day
                          </Label>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Notes
                        </Label>
                        <Input
                          value={row.notes}
                          placeholder="Optional"
                          disabled={isDisabled}
                          onChange={(event) =>
                            handleOverrideChange(index, { notes: event.target.value })
                          }
                          className="mt-1 h-9"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOverride(index)}
                          disabled={isDisabled}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Remove override</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SettingsCard>
    </TooltipProvider>
  );
}
